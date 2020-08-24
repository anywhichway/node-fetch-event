const fs = require("fs"),
	fspath = require("path"),
	process = require("process"),
	stream = require("stream"),
	fetch = require("node-fetch"),
	cluster = require('cluster'),
	numCPUs = require('os').cpus().length,
	requireFromUrl = require('require-from-url/sync');

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

const workerCache = {};

function route(toMatch,worker,url,aroute) {
	if(toMatch==="*") {
		if(url.pathname.endsWith("/")) {
			return aroute || {path:url.pathname + worker};
		}
		return url.pathname.endsWith(".js") ? {path:url.pathname} : {path:url.pathname + ".js"};
	}
	if(toMatch==url.pathname) {
		return aroute ||  (url.pathname.endsWith(".js") ? {path:url.pathname} : {path:url.pathname + ".js"});
	}
	if(toMatch && typeof(toMatch)==="object") {
		for(const key in toMatch) {
			const match = route(key,worker,url,toMatch[key]);
			if(match) {
				return match;
			}
		}
	}
}

function server({protocol="http",hostname="localhost",port=3000,maxWorkers=1,keys={},worker="worker.js",standalone,cacheWorkers,workerSource,routes="*"},cb) {
		const createServer = () => { 
			protocols[protocol].createServer(async (req,res) => {
				const request = new Request(req),
					response = new Response(res),
					event = new FetchEvent({request,response});
				const {path,ttl} = route(routes,worker,new URL(request.url))||{};
				console.log(path)
				// handle 404 here if no worker path
				if(ttl) {
					cacheWorkers = ttl;
				}
				let theworker = workerCache[path];
				if(!theworker) {
					if(workerSource) {
						{
							theworker = requireFromUrl(`${workerSource}${path}`)
							if(cacheWorkers) {
								workerCache[path] = theworker;
								if(typeof(cacheWorkers)==="number") {
									setInterval(() => delete workerCache[path],cacheWorkers*1000);
								}
							}
						}
					} else {
							const cwdWorkerPath = fspath.join(process.cwd(),worker),
								nodeWorkerPath =  fspath.join( __dirname,worker);
						try {
							theworker = require(cwdWorkerPath);
							path = nodeWorkerPath;
							if(cacheWorkers) {
								 workerCache[path] = theworker;
							}
						} catch(e) {
							theworker = require(nodeWorkerPath);
							path = nodeWorkerPath;
							if(cacheWorkers) {
								workerCache[path] = theworker;
								if(typeof(cacheWorkers)==="number") {
									setInterval(() => delete workerCache[path],cacheWorkers);
								}
							}
						}
					}
				}
				// handle 404 here if no worker path
				theworker({addEventListener,caches,fetch,Response,Request});
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
			cb({processId:process.pid,maxWorkers,protocol,port,hostname,standalone,cacheWorkers,workerSource})
		}
	} else {
		if (cluster.isMaster) {
		for (let i = 0; i < Math.min(numCPUs,maxWorkers); i++) {
			cluster.fork();
		}
		if(cb) {
			cb({processId:process.pid,maxWorkers,protocol,port,hostname,standalone,cacheWorkers,workerSource})
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
