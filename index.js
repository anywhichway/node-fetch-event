const fs = require("fs").promises,
	fspath = require("path"),
	process = require("process"),
	stream = require("stream"),
	fetch = require("node-fetch"),
	cluster = require('cluster'),
	numCPUs = require('os').cpus().length;

import { Worker } from "worker_threads";

import Request from "./src/request.js";
import Response from "./src/response.js";
import FetchEvent from "./src/fetch-event.js";
import route from "./src/route.js";

const protocols = {
	http:  require("http"),
	https: require("https")
}

const workerCache = {};

function runService(worker,data) {
	let resolver,
		rejector;
	const promise = new Promise((resolve, reject) => { resolver = resolve; rejector = reject; }),
		onmessage = (message) => resolver(message),
		onerror = (error) => rejector(error);
	worker.hit = Date.now();
	worker.on("message", onmessage);
	worker.on("error", onerror);
	worker.postMessage(JSON.stringify(data));
	promise.finally(() => {
		worker.removeListener("message",onmessage);
		worker.removeListener("error",onerror);
	});
	return promise;
}

async function initializeWorker(source,{cacheWorkers,workerPath,maxIdle=60000}) {
	let root = `node-fetch-event`;
		try {
			require(root);
		} catch(e) {
			root = `${__dirname}/src`; // running in a fork
		}
	const code = `
		import { parentPort } from "worker_threads";
		try {
			const requireFromUrl = require('require-from-url/sync'),
				crypto = new require("node-webcrypto-ossl"),
				{ atob, btoa } = require('abab'),
				fetch = require("node-fetch");
			import { TextEncoder, TextDecoder } from "util";
			import Request from "${root}/request.js";
			import Response from "${root}/response.js";
			import addEventListener from "${root}/add-event-listener.js";
			import FetchEvent from "${root}/fetch-event.js";
			import Cache from "${root}/cache.js";
			import KVStore from "${root}/kv-store.js";
			
			const caches = {
				default:new Cache()
			};
			${source};
			parentPort.on("message",(workerData) => {
				if(workerData==="close") {
					parentPort.close();
					return;
				}
				const data = JSON.parse(workerData),
					__fetchevent__ = new FetchEvent({request:new Request(data.url,data)});
				if(data.params) {
					Object.defineProperty(__fetchevent__.request,"params",{value:data.params});
				}
				addEventListener.fetch(__fetchevent__);
				__fetchevent__.response.then(async (response) => {
					const body = await response.text(),
						options = Object.assign({},response);
					if(body!=null && body!=="undefined") {
						options.body = body;
					}
					parentPort.postMessage(JSON.stringify(options));
					await Promise.all(__fetchevent__.awaiting);
				}).catch(e => {
					parentPort.close(e+"");
				});
			});
		} catch (e) {
			//parentPort.postMessage();
			parentPort.close(e+"");
		}`;
	let worker;
	try {
		worker = new Worker(code, {eval:true});
	} catch(e) {
		console.log(e);
	}
	worker.hit = Date.now();
	setInterval(() => {
		if(Date.now()-worker.hit>maxIdle) {
			worker.postMessage("close");
		}
	})
	worker.on('exit', (code) => {
		const {source} = workerCache[workerPath]||{};
		if (code !== 0) {
			console.log(code)
		}
		if(source) {
			 workerCache[workerPath] = source;
		}
	});
	if(cacheWorkers) {
		workerCache[workerPath] = {source,worker};
		if(typeof(cacheWorkers)==="number") {
			setInterval(() => {
				if(workerCache[workerPath]) {
					!workerCache[workerPath].close || workerCache[workerPath].close();
					delete workerCache[workerPath];
				}
			},cacheWorkers);
		}
	}
	return worker;
}

function server({protocol="http",hostname="localhost",port=3000,maxServers=1,keys={},worker="worker",standalone,cacheWorkers,workerSource,routes="*",workerFailureMode="open"},cb) {
		const createServer = () => { 
			protocols[protocol].createServer(async (req,res) => {
				try {
				const request = new Request(req),
					response = new Response(res),
					event = new FetchEvent({request,response});
				let {path,maxAge,timeout,maxIdle,params,useQuery} = route(routes,request,worker)||{};
				if(!path) {
					res.status = 404;
					res.end();
					return;
				}
				const ishttp =  path.startsWith("http://") || path.startsWith("https://");
				let url;
				if(!ishttp) {
					url = new URL(`http://localhost${path.startsWith("/") ? path : "/"+path}`);
					path = url.pathname;
					let parts = path.split(),
						last = parts.pop().split(".");
					if(last.length>1) {
						// handle file
					}
					path = last.pop();
					if(path==="") {
						// handle error
					}
					path = `${path}.js`; // it is a worker call
				}
				// get params from path as defaults
				for(const [key, value] of url.searchParams) {
					if(params[key]===undefined) {
						try {
							params[key] = JSON.parse(value);
						} catch(e) {
							params[key] = value;
						}
					}
				}
				// get params from request query string if allowed
				if(useQuery) {
					url = new URL(request.url);
					for(const [key, value] of url.searchParams) {
						try {
							params[key] = JSON.parse(value);
						} catch(e) {
							params[key] = value;
						}
					}
				}
				if(maxAge) {
					cacheWorkers = maxAge;
				}
				let	workerPath,
					theworker,
					thesource;
				if(workerSource || ishttp) {
					workerPath = path.startsWith("http") ? path : `${workerSource}${path}`;
					const {worker,source} = workerCache[workerPath]||{};
					if(!source) {
						const response = await fetch(workerPath);
						if(!response.ok) {
							return response;
						}
						const text = await response.text();
						if(text.includes("addEventListener")) {
							theworker = await initializeWorker(text,{cacheWorkers,workerPath,maxIdle});
						} else {
							// respond with text
						}
					} else {
						theworker = worker;
						thesource = source;
					}
				} else {
					workerPath = fspath.join(process.cwd(),path);
					try {
						const {worker,source} = workerCache[workerPath]||{};
						if(!source) {
							const text = await fs.readFile(workerPath);
							if(text.includes("addEventListener")) {
								theworker = await initializeWorker(text,{cacheWorkers,workerPath,maxIdle});
							} else {
								// respond with error
							}
						} else {
							theworker = worker;
							thesource = source;
						}
					} catch(e) {
						workerPath =  fspath.join( __dirname,path);
						const {worker,source} = workerCache[workerPath]||{};
						if(!source) {
							const text = await fs.readFile(workerPath);
							if(text.includes("addEventListener")) {
								theworker = await initializeWorker(text,{cacheWorkers,workerPath,maxIdle});
							} else {
								// respond with error
							}
						} else {
							theworker = worker;
							thesource = source;
						}
					}
				}
				if(!theworker) {
					theworker = await initializeWorker(thesource,{cacheWorkers,workerPath,maxIdle});
				}
				const options = Object.assign({},request,{params}),
						body = await request.text();
				if(body!=="undefined") {
					options.body = body;
				}
				const result = JSON.parse((await runService(theworker,options))||"null"),
					finalresponse = new Response(result);
				if(!result) {
					throw TypeError("respondWith did not return a Response");
				}
				if(finalresponse.body instanceof stream.Readable) {
					finalresponse.body.on('data', chunk => res.write(chunk));
					finalresponse.body.on('end', () => {
						res.end();
					})
				} else {
					res.end(await finalresponse.text());
				}
				await Promise.all(event.awaiting);
				} catch(e) {
					if(workerFailureMode==="open") {
						res.statusCode = 500;
						res.end();
					} else if(workerFailureMode==="error") {
						res.write(e+"");
						res.end();
					}
					// else swallow and become non-responsive to request
				}
			}).listen(port,hostname);
		};
			
	if(standalone) {
		createServer();
		if(cb) {
			cb({processId:process.pid,maxServers,protocol,port,hostname,standalone,cacheWorkers,workerSource})
		}
	} else {
		if (cluster.isMaster) {
		for (let i = 0; i < Math.min(numCPUs,maxServers); i++) {
			cluster.fork();
		}
		if(cb) {
			cb({processId:process.pid,maxServers,protocol,port,hostname,standalone,cacheWorkers,workerSource})
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
module.exports = server
server.server = server;
