const fs = require("fs").promises,
	fspath = require("path"),
	process = require("process"),
	stream = require("stream"),
	fetch = require("node-fetch"),
	cluster = require('cluster'),
	numCPUs = require('os').cpus().length,
	requireFromUrl = require('require-from-url/sync');

import Request from "./src/request.js";
import Response from "./src/response.js";
import route from "./src/route.js";
import ServiceWorkerFactory from "./src/service-worker-factory.js";

const protocols = {
	http:  require("http"),
	https: require("https")
}

async function server({
		protocol="http",
		hostname="localhost",
		port=3000,
		maxServers=4,
		keys={},
		defaultWorkerRoot = process.cwd(),
		workerLimits={},
		workerFailureMode="open",
		workerFailureErrorHeaders={"allow-origin":"*"},
		routes="*"
		},cb) {
	if(typeof(routes)==="string") {
		if(routes.startsWith("http:") | routes.startsWith("https:")) {
			if(routes.endsWith("json")) {
				const response = await fetch(routes);
				routes = await response.json();
			} else if(routes.endsWith(".js")) {
				routes = requireFromUrl(routes);
			}
		} else {
			let paths = [fspath.join(process.cwd(),routes),fspath.join( __dirname,routes)];
			if(routes.endsWith(".json")) {
				for(const path of paths) {
					try {
						const json = await fs.readFile(routes);
						routes = JSON.parse(json);
						break;
					} catch(e) {
						; // ignore, may be a legit path spec
					}
				}
			} else if(routes.endsWith(".js")) {
				for(const path of paths) {
					try {
						routes = require(path);
						break;
					} catch(e) {
						; // ignore, may be a legit path spec
					}
				}
			}
		}
	}
	const serviceWorkerFactory = new ServiceWorkerFactory(Object.assign({},workerLimits,{defaultWorkerRoot})),
		createServer = () => {
			protocols[protocol].createServer(async (req,res) => {
				const request = new Request(req),
					response = new Response(res);
				let finalresponse;
				try {
					finalresponse = await route(routes,request,response,serviceWorkerFactory);
				} catch(e) {
					if(workerFailureMode==="open") {
						finalresponse = new Response(null,{status:500});
					} else if(workerFailureMode==="error") {workerFailureErrorHeaders
						finalresponse = new Response(e+"\n"+e.stack,{status:500});
						Object.entries(workerFailureErrorHeaders||{}).forEach(([key,value]) => finalresponse.headers.set(key,value));
					} else {
						throw e; // else swallow, force crash and restart
					}
				}
				res.statusCode = finalresponse.status;
				res.statusMessage = finalresponse.statusText;
				for(const [key,value] of finalresponse.headers.entries()) {
					res.setHeader(key,value);
				}
				if(finalresponse.body instanceof stream.Readable) {
					finalresponse.body.on('data', chunk => res.write(chunk));
					finalresponse.body.on('end', () => {
						res.end();
					})
				} else if(finalresponse.body instanceof stream.Writable)  {
					res.end(finalresponse.body.writableBuffer);
				} else {
					res.end(await finalresponse.text());
				}
			}).listen(port,hostname);
		};
	if(maxServers>=2) {
		if (cluster.isMaster) {
			for (let i = 0; i < Math.min(numCPUs,maxServers); i++) {
				cluster.fork();
			}
			if(cb) {
				cb({processId:process.pid,maxServers,protocol,port,hostname,defaultWorkerRoot})
			}
			cluster.on("exit", (worker, code, signal) => {
					console.log(`worker ${worker.process.pid} died ${code} ${signal}`);
					cluster.fork();
				});
		} else {
			createServer();
		}
	} else {
		createServer();
		if(cb) {
			cb({processId:process.pid,maxServers,protocol,port,hostname,defaultWorkerRoot})
		}
	}
}

export { server as default, server }
module.exports = server
server.server = server;
