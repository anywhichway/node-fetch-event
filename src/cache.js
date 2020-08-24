/* This file is part of node-fetch-event. It is provided under GNU AFFERO GENERAL PUBLIC LICENSE, Version 3, 19 November 2007. Copyright (c) 2020 Simon Y. Blackwell */
import { Request } from "./request.js";
import { Response } from "./response.js";

const getKey = function(requestOrString) {
	const type = typeof(requestOrString);
	if(type==="string") {
		try {
			new URL(requestOrString);
		} catch(e) {
			if(!this.relaxedURLs) {
				throw e;
			}
		}
		return requestOrString;
	} else if(requestOrString && type=="object" && requestOrString instanceof Request){
		return requestOrString.url;
	}
	throw new TypeError(`cache key expected to be url string or Request`)
}

const match = (request,object,{ignoreSearch,ignoreMethod,ignoreVary}={}) => {
	if(request.url!==object.url) {
		return false;
	}
	if(!ignoreSearch) {
		try {
			if(new URL(request.url).search!==new URL(object.url).search) {
				return false;
			}
		} catch(e) {
			return false;
		}
	}
	if(!ignoreMethod) {
		if(request.method!=object.method) {
			return false;
		}
	}
	return true;
}

class Cache {
	constructor({relaxedURLs,storage=new Map()}={}) {
		this.relaxedURLs = !!relaxedURLs;
		this.storage = storage;
	}
	async delete(requestOrString,{ignoreSearch,ignoreMethod,ignoreVary,cacheName}={}) {
		const type = typeof(requestOrString);
		if(type==="string") {
			requestOrString = new Request({});
			requestOrString.url = requestOrString;
		}
		for(const request of this.storage.keys()) {
			if(match(requestOrString,request,{ignoreSearch,ignoreMethod,ignoreVary})) {
				this.storage.delete(request);
			}
		}
	}
	async keys(requestOrString,{ignoreSearch,ignoreMethod,ignoreVary}={}) {
		const results = [],
			type = typeof(requestOrString);
		if(type==="string") {
			requestOrString = new Request({});
			requestOrString.url = requestOrString;
		}
		for(const request of this.storage.keys()) {
			if(match(requestOrString,request,{ignoreSearch,ignoreMethod,ignoreVary})) {
				results.push(request.clone());
			}
		}
		return results;
	}
	async match(requestOrString,{ignoreSearch,ignoreMethod,ignoreVary}={}) {
		const type = typeof(requestOrString);
		if(type==="string") {
			requestOrString = new Request({});
			requestOrString.url = requestOrString;
		}
		for(const [request,response] of this.storage.entries()) {
			if(match(requestOrString,request,{ignoreSearch,ignoreMethod,ignoreVary})) {
				return response.clone();
			}
		}
	}
	async matchAll(requestOrString,{ignoreSearch,ignoreMethod,ignoreVary}={}) {
		const results = [],
			type = typeof(requestOrString);
		if(type==="string") {
			requestOrString = new Request({});
			requestOrString.url = requestOrString;
		}
		for(const [request,response] of this.storage.entries()) {
			if(match(requestOrString,request,{ignoreSearch,ignoreMethod,ignoreVary})) {
				results.push(response.clone());
			}
		}
		return results;
	}
	async put(requestOrString,response) {
		const t1 = typeof(requestOrString),
			t2 = typeof(response);
		if(t1!=="string" && !requestOrString && t1!=="object" && !(requestOrString instanceof requestOrString)) {
			throw new TypeError("cache put expected string or Request as first argument")
		}
		if(!response || t2!=="object" || !(response instanceof Response)) {
			throw new TypeError("cache put expected Response as second argument")
		}
		let request;
		if(t1==="string") {
			const key = getKey.call(this,requestOrString);
			request = new Request({}); // avoid construct type errors
			request.url = key;
		} else {
			request = requestOrString.clone();
		}
		this.storage.set(request,response.clone());
	}
}

export {Cache as default,Cache};
module.exports = {Cache};