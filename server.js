'use strict';

var https = require('https'),
    HttpProxy = require('http-proxy'),
    express = require('express'),
    prerender = require('prerender-node'),
    tls = require('tls'),
    fs = require('fs'),
    path = require('path'),
    config = require('./config');

/** Initialize proxy. */
var proxy = new HttpProxy();

/** Initialize the main HTTP proxy server. */
var httpServer = express();

/** Initialize the node vhost server. */
var vhostServer = express(),
    vhost = require('vhost');

/** Map of hosts and their corresponding ports. */
var httpHosts = config.httpHosts,
    httpsHosts = config.httpsHosts;

/** Add the prerender middleware to the server. */
httpServer.use(prerender.set('prerenderToken', config.prerenderToken));

/** Add the proxy to the server's middleware. */
httpServer.use(function(req, res, next){
    /** If the host is in the list of HTTPS hosts, redirect. */
    if (httpsHosts[req.headers.host]) {
	return res.redirect('https://' + req.headers.host + req.url);
    }

    if (!httpHosts[req.headers.host]) {
	res.writeHead(404);
	return res.end();
    }

    var host = httpHosts[req.headers.host].host || req.headers.host,
        port = httpHosts[req.headers.host].port || 80,
        protocol = 'http://';

    /** Now proxy the request. */
    return proxy.web(req, res, {
        target: protocol + host + ':' + port
    });
});

/** Define SSL options. */
var getCredentialsContext = function(name) {
    return tls.createSecureContext({
        key: fs.readFileSync(path.join(__dirname, 'certificates', name, 'ssl.key')),
        cert: fs.readFileSync(path.join(__dirname, 'certificates', name, 'ssl-unified.crt'))
    }).context;
};

var certs = config.certs;

var options = {
    SNICallback: function(hostname, cb) {
        return cb(null, getCredentialsContext(certs[hostname]));
    },
    key: fs.readFileSync(path.join(__dirname, 'certificates', 'kushcode', 'ssl.key')),
    cert: fs.readFileSync(path.join(__dirname, 'certificates', 'kushcode', 'ssl-unified.crt'))
};

/** Initialize the main HTTPS proxy server. */
var httpsServer = https.createServer(options, function (req, res) {
    if (!httpsHosts[req.headers.host]) {
	res.writeHead(404);
	return res.end();
    }

    var host = httpsHosts[req.headers.host].host || req.headers.host,
        port = httpsHosts[req.headers.host].port || 443,
	protocol = httpsHosts[req.headers.host].protocol || 'https://'

    /** Now proxy the request. */
    return proxy.web(req, res, {
        target: protocol + host + ':' + port
    });
}).on('upgrade', function (req, socket, head) {
    if (!httpsHosts[req.headers.host]) {
	socket.write(404);
	return socket.end();
    }

    var host = httpsHosts[req.headers.host].host || req.headers.host,
        port = httpsHosts[req.headers.host].port || 443,
	protocol = 'wss://';

    /** Now proxy the socket. */
    return proxy.ws(req, socket, head, {
        target: protocol + host + ':' + port
    });
});

/** Configure the vhost server to serve multiple node apps. */
vhostServer
.enable('trust proxy')
.use(vhost('lsvx.com', require('lsvx.com')))
.listen(8000);

/** Start the listening. */
httpServer.listen(80)
httpsServer.listen(443);
