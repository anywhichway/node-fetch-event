const fs = require("fs").promises,
	fspath = require("path"),
	fetch = require("node-fetch"),
	deepEqual = require('fast-deep-equal');

import { Worker } from "worker_threads";
import { Response } from "./response.js";

function runService(worker,data) {
	let onmessage, onerror;
	const promise = new Promise((resolve,reject) => {
		worker.hit = Date.now();
		worker.on("message", onmessage = (message) => resolve(message));
		worker.on("error", onerror = (error) => reject(error));
		worker.postMessage(JSON.stringify(data));
	})
	promise.finally(() => {
		worker.removeListener("message",onmessage);
		worker.removeListener("error",onerror);
	});
	return promise;
}

async function initializeWorker(source,{cpuUsage,maxYoungGenerationSizeMb,maxOldGenerationSizeMb,codeRangeSizeMb,stackSizeMb,maxIdle,maxAge,path,cache}) {
	/*let root = `node-fetch-event`;
		try {
			require(root);
		} catch(e) {
			root = `${__dirname}/src`; // running in a fork
		}*/
	let root = __dirname;
	const code = `
		let crypto;
		try {
			//const Crypto = require("node-webcrypto-ossl");
			//crypto = new Crypto();
			crypto = require("webcrypto");
		} catch (e) {
			console.log("Crypto failed to load");
			console.log(e)
		}
		import { parentPort } from "worker_threads";
		import { TextEncoder, TextDecoder } from "util";
		const requireFromUrl = require('require-from-url/sync'),
				{ atob, btoa } = require('abab'),
				fetch = require("node-fetch");
		import Request from "${root}/request.js";
		import Response from "${root}/response.js";
		import addEventListener from "${root}/add-event-listener.js";
		import FetchEvent from "${root}/fetch-event.js";
		import {CacheStorage, Cache} from "${root}/cache-storage.js";
		import KVStore from "${root}/kv-store.js";
		const cpuUsage = ${cpuUsage};
		try {
			const caches = {
				default: new Cache("default")
			};
			${source};
			parentPort.on("message",(workerData) => {
				if(workerData==="close") {
					parentPort.close();
					return;
				}
				const previousUsage = process.cpuUsage(),
					data = JSON.parse(workerData),
					__fetchevent__ = new FetchEvent({request:new Request(data.url,data)});
				if(data.params) {
					Object.defineProperty(__fetchevent__.request,"params",{value:data.params});
				}
				addEventListener.fetch(__fetchevent__);
				__fetchevent__.response
					.then(async (response) => {
						/* test cpu spin */
						//const now = Date.now();
						//while (Date.now() - now < cpuUsage);
						/* end test cpu spin */
						// move earlier, perhaps interval
						const {user,system} = process.cpuUsage(previousUsage),
							used = (user+system)/1000;
						//console.log(used,user,system,cpuUsage)
						if(used>cpuUsage) {
							//console.log("Max CPU time ${cpuUsage} exceeded:" + used);
							parent.port.close(1)
						} else {
							const body = await response.text(),
								options = Object.assign({},response);
							options.headers = response.headers.toJSON();
							if(body!=null && body!=="undefined") {
								options.body = body;
							}
							parentPort.postMessage(JSON.stringify(options));
							await Promise.all(__fetchevent__.awaiting);
						}
					}).catch(e => {
						const options = {status:500};
						options.body = e + " " + e.stack;
						parentPort.postMessage(JSON.stringify(options));
						parentPort.close(1);
					});
			});
		} catch (e) {
			const options = {status:500};
			options.body = e + " " + e.stack;
			parentPort.postMessage(JSON.stringify(options));
			parentPort.close(1);
		}`;
	let worker;
	try {
		worker = new Worker(code, {eval:true,resourceLimits:{maxYoungGenerationSizeMb,maxOldGenerationSizeMb,codeRangeSizeMb,stackSizeMb}});
	} catch(e) {
		console.log("Worker Error:" + e);
	}
	worker.hit = Date.now();
	let interval, timeout;
	if(maxIdle>0) {
		interval = setInterval(() => {
			if(Date.now()-worker.hit>maxIdle) {
				clearInterval(interval);
				if(timeout) {
					clearTimeout(timeout)
				}
				worker.postMessage("close");
			}
		},maxIdle);
	}
	if(maxAge>0) {
		timeout = setTimeout(() => {
			if(interval) {
				clearInterval(interval)
			}
			worker.postMessage("close");
		},maxAge);
	}
	worker.on('exit', (code) => {
		const {source} = cache ? cache[path]||{} : {};
		if (code !== 0) {
			console.log(code)
		}
		if(source) {
			 cache[path] = {source};
		}
	});
	return worker;
}

class ServiceWorkerFactory {
	constructor({
		defaultWorkerRoot,
		defaultWorkerName,
		maxAge,
		maxCache,
		maxIdle=60000,
		maxYoungGenerationSizeMb=256,
		maxOldGenerationSizeMb=256,
		stackSizeMb=4,
		//stackDepth, // should we, can we add stackDepth control
		codeRangeSizeMb=2,
		cpuUsage=5000,
		maxTime=8000}) {
			this.options = Object.assign({},{
				defaultWorkerRoot,
				defaultWorkerName,
				maxAge,
				maxCache,
				maxIdle,
				maxYoungGenerationSizeMb,
				maxOldGenerationSizeMb,
				stackSizeMb,
				//stackDepth, // should we, can we add stackDepth control
				codeRangeSizeMb,
				cpuUsage,
				maxTime
			});
			if(maxCache>0) {
				this.cache = {};
			}
			Object.freeze(this.options);
		}
	get(path,options) { // options are same as factory plus useQuery, params
		let {worker} = this.cache ? this.cache[path]||{} : {};
		if(!worker || (options && !deepEqual(worker.options,options))) {
			return ServiceWorker.create(path, Object.assign({},{cache:this.cache},this.options,options));
		}
		return worker;
	}
}

class ServiceWorker {
	constructor(path,{
		source,
		worker,
		defaultWorkerRoot,
		defaultWorkerName,
		useQuery,
		params={},
		maxAge,
		maxCache,
		maxIdle,
		maxYoungGenerationSizeMb,
		maxOldGenerationSizeMb,
		stackSizeMb,
		//stackDepth, // should we, can we add stackDepth control
		codeRangeSizeMb,
		cpuUsage,
		cache,
		maxTime}) {
		let url;
		if(path.startsWith("http://") || path.startsWith("https://")) {
			url = new URL(path);
		} else {
			url = new URL(`http://localhost${path.startsWith("/") ? path : "/"+ path}`);
		}
		const options = {
			defaultWorkerRoot,
			defaultWorkerName,
			useQuery,
			params,
			maxAge,
			maxCache,
			maxIdle,
			maxYoungGenerationSizeMb,
			maxOldGenerationSizeMb,
			stackSizeMb,
			//stackDepth, // should we, can we add stackDepth control
			codeRangeSizeMb,
			cpuUsage,
			maxTime
		}
		Object.freeze(options);
		Object.defineProperty(this,"options",{enumerable:true,value:options});
		Object.defineProperty(this,"worker",{enumerable:true,value:worker});
		if(cache) {
			cache[path] = {source,worker:this};
			if(maxCache>0) {
				setTimeout(() => {
					delete cache[path];
				},maxCache);
			}
		}
	}
	async run(request,response) {
		const runoptions = Object.assign({},{params:this.options.params||{}},request),
				body = await request.clone().text();
		if(body!=="undefined" && body!=="") {
			runoptions.body = body;
		}
		if(this.options.useQuery) {
			const url = new URL(request.url);
			for(const [key, value] of url.searchParams) {
				try {
					runoptions.params[key] = JSON.parse(value);
				} catch(e) {
					runoptions.params[key] = value;
				}
			}
		}
		let timeout;
		if(this.options.maxTime) {
			timeout = setTimeout(() => {
				this.worker.postMessage("close");
			},this.options.maxTime)
		}
		const result = await runService(this.worker,runoptions);
		if(timeout) {
			clearTimeout(timeout);
		}
		if(result) {
			try {
				return new Response(JSON.parse(result));
			} catch(e) {
				return  new Response("respondWith did not return a Response",{status:500})
			}
		}
		return  new Response("respondWith did not return a Response",{status:500})
	}
	static async create(path,options) {
		let {source} = options.cache ? options.cache[path]||{} : {};
		let sourcepath;
		if(!source) {
			if(path.startsWith("http://") || path.startsWith("https://")) {
				sourcepath = path;
				const response = await fetch(path);
					source = await response.text();
			} else if(options.defaultWorkerRoot.startsWith("http://") || options.defaultWorkerRoot.startsWith("https://")) {
				sourcepath = path;
				const root = options.defaultWorkerRoot,
					response = await fetch((root.endsWith("/") ? root.substring(0,root.length-1) : root ) + (sourcepath.startsWith("/") ? sourcepath : "/" + sourcepath));
				source = await response.text();
			} else {
				const root = options.defaultWorkerRoot,
					url = new URL(`http://localhost${(path.startsWith("/") ? path : "/" + path)}`),
					parts = url.pathname.split("/");
				if(!parts[parts.length-1].endsWith(".js")) {
					parts[parts.length-1] = parts[parts.length-1] + ".js";
				}
				sourcepath = parts.join("/");
				//path = url.pathname;
				source = await fs.readFile(fspath.join((root.endsWith("/") ? root.substring(0,root.length-1) : root ) + (sourcepath.startsWith("/") ? sourcepath : "/" + sourcepath)),"utf8");
			}
		}
		return new ServiceWorker(path,Object.assign({},options,{source,worker:await initializeWorker(source,{...options,path})}));
	}
}


export { ServiceWorkerFactory as default, ServiceWorkerFactory }
module.exports = ServiceWorkerFactory;
ServiceWorkerFactory.ServiceWorkerFactory = ServiceWorkerFactory;
