'use strict';

var https = require('https'),
    HttpProxy = require('http-proxy'),
    express = require('express'),
    prerender = require('prerender-node'),
    crypto = require('crypto'),
    fs = require('fs'),
    path = require('path'),
    config = require('./config');

/** Initialize proxy. */
var proxy = new HttpProxy({ changeOrigin: true });

/** Initialize the main HTTP proxy server. */
var httpServer = express();

/** Initialize the node vhost server. */
var vhostServer = express(),
    vhost = require('vhost');

/** Map of hosts and their corresponding ports. */
var httpPorts = {
    'lsvx.com': 8000,
    'doorbellyo.com': 5000,
    'nginx': 9001
    },
    httpsPorts = {
    'notebook.kushcode.com': 9999,
};

/** Add the prerender middleware to the server. */
httpServer.use(prerender.set('prerenderToken', config.prerenderToken));

/** Add the proxy to the server's middleware. */
httpServer.use(function(req, res, next){
    var host = req.headers.host,
        port = httpPorts[host] ? httpPorts[host] : httpPorts['nginx'];

    /** If the host is in the list of HTTPS hosts, redirect. */
    if (httpsPorts[host]) {
	return res.redirect('https://' + host + req.url);
    }

    /** Now proxy the request. */
    return proxy.web(req, res, {
        target: {
            host: 'localhost',
            port: port
        }
    });
});

/** Define SSL options. */
var getCredentialsContext = function(name) {
    return crypto.createCredentials({
        key: fs.readFileSync(path.join(__dirname, 'certificates', name, 'ssl.key')),
        cert: fs.readFileSync(path.join(__dirname, 'certificates', name, 'ssl-unified.crt'))
    }).context;
};

var certs = {
    'notebook.kushcode.com': getCredentialsContext('kushcode')
};

var options = {
    SNICallback: function(hostname) {
        return certs[hostname];
    },
    key: fs.readFileSync(path.join(__dirname, 'certificates', 'kushcode', 'ssl.key')),
    cert: fs.readFileSync(path.join(__dirname, 'certificates', 'kushcode', 'ssl-unified.crt'))
};

/** Initialize the main HTTPS proxy server. */
var httpsServer = https.createServer(options, function (req, res) {
    var host = req.headers.host,
        port = httpsPorts[host] ? httpsPorts[host] : httpPorts['nginx'];

    /** Now proxy the request. */
    return proxy.web(req, res, {
        target: 'https://' + host + ':' + port
    });
}).on('upgrade', function (req, socket, head) {
    var host = req.headers.host,
        port = httpsPorts[host] ? httpsPorts[host] : httpPorts['nginx'];

    /** Now proxy the socket. */
    return proxy.ws(req, socket, head, {
        target: 'wss://' + host + ':' + port
    });
});

/** Configure the vhost server to serve multiple node apps. */
vhostServer
.enable('trust proxy')
//.use(vhost('lsvx.com', require('./lsvx/app')))
.listen(8000);

/** Start the listening. */
httpServer.listen(80)
httpsServer.listen(443);
