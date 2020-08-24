const fs = require("fs"),
	path = require("path"),
	process = require("process"),
	stream = require("stream"),
	fetch = require("node-fetch"),
	cluster = require('cluster'),
	numCPUs = require('os').cpus().length;

import Request from "./src/request.js";
import Response from "./src/response.js";
import FetchEvent from "./src/fetch-event.js";
import Cache from "./src/cache.js";

const caches = {
		default:new Cache()
	};
	
const listeners = {};
listeners.fetch = () => {};

const addEventListener = (eventName,handler) => {
	listeners[eventName] = handler;
}

const protocols = {
	http:  require("http"),
	https: require("https")
}

const workerCache = {
	
}

let workerPath;

function server({protocol="http",hostname="localhost",port=3000,maxWorkers=1,keys={},worker="worker.js",standalone,cacheWorkers},cb) {
	const cwdWorkerPath = path.join(process.cwd(),worker),
		nodeWorkerPath =  path.join( __dirname,worker),
		createServer = () => { 
			protocols[protocol].createServer(async (req,res) => {
				const request = new Request(req),
					response = new Response(res),
					event = new FetchEvent({request,response});
				let worker = workerCache[workerPath];
				if(!worker) {
					try {
						worker = require(cwdWorkerPath);
						workerPath = nodeWorkerPath;
						if(cacheWorkers) {
							 workerCache[workerPath] = worker;
						}
					} catch(e) {
						worker = require(nodeWorkerPath);
						workerPath = nodeWorkerPath;
						if(cacheWorkers) {
							 workerCache[workerPath] = worker;
						}
					}
				}
				worker({addEventListener,caches,fetch,Response,Request});
				listeners.fetch(event);
				let finalresponse = await event.response;
				if(finalresponse instanceof fetch.Response) {
					const clone =  input.clone();
					finalresponse = new Response(clone.body,clone);
				}
				if(!finalresponse || typeof(finalresponse)!=="object" || !(finalresponse instanceof Response)) {
					throw TypeError("respondWith did not return a Response");
				}
				if(finalresponse!=response) {
					if(finalresponse.body instanceof stream.Readable) {
						finalresponse.body.on('data', chunk => { console.log(chunk.toString()); res.write(chunk); });
						finalresponse.body.on('end', () => {
							res.end();
						})
					} else {
						res.end(finalresponse.body);
					}
				}
				await Promise.all(event.awaiting);
			}).listen(port,hostname);
		};
			
	if(standalone) {
		createServer();
		if(cb) {
			cb({processId:process.pid,maxWorkers,protocol,port,hostname,standalone})
		}
	} else {
		if (cluster.isMaster) {
		for (let i = 0; i < Math.min(numCPUs,maxWorkers); i++) {
			cluster.fork();
		}
		if(cb) {
			cb({processId:process.pid,maxWorkers,protocol,port,hostname,standalone})
		}
		cluster.on("exit", (worker, code, signal) => {
				console.log(`worker ${worker.process.pid} died ${code} ${signal}`);
				cluster.fork();
			});
		} else {
			createServer();
		}
	}
}

export { server as default, server }
module.exports = { server }
