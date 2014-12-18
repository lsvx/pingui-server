'use strict';
var http = require('http');
http.globalAgent.maxSockets = 100;

/** Module dependancies */
var httpProxy = require('http-proxy'),
    express = require('express'),
    prerender = require('prerender-node'),
    config = require('./config');

/** Initialize proxy. */
var proxy = httpProxy.createProxyServer({});

/** Initialize vhost server. */
var vhostServer = express(),
    vhost = require('vhost');

/** Initialize the main server. */
var server = express();

/** Map of hosts and their corresponding ports. */
var ports = {
    'lsvx.com': 8000,
    'doorbellyo.com': 5000,
    'nginx': 9001
};

/** Add the prerender middleware to the server. */
server.use(prerender.set('prerenderToken', config.prerenderToken));

/** Add the proxy to the server's middleware. */
server.use(function(req, res, next){
    var host = req.headers.host,
        port = ports[host] ? ports[host] : ports['nginx'];

    /** Now proxy the request. */
    proxy.web(req, res, {
        target: {
            host: 'localhost',
            port: port
        }
    });
});

/** Configure the server. */
server.listen(80, function() {
    process.setgid(1003);
    process.setuid(1002);
});

/** Configure the vhost server. */
vhostServer
.enable('trust proxy')
.use(vhost('lsvx.com', require('./lsvx/app')))
.listen(8000);
