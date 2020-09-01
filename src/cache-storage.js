const fs = require("fs").promises;
const fetch = require("node-fetch");
const glob = require("glob");
import Request from "./request.js";
import Response from "./response.js";
import AsyncStorage from "./async-storage.js";

async function serializable(source) {
	const json = source.toJSON();
	json.body = await resolveBody(source);
	return json;
}

async function resolveBody(source) {
	if(typeof(source.blob)==="function") {
		const blob = await source.blob();
		if(blob) {
			return blob.text();
		}
		return null;
	}
	if(typeof(source.text)==="function") {
		return source.text();
	}
	return JSON.stringify(source.body);
}

function getTtl(response) {
	if(response.status<200 || response.status>500) {
		return 0
	}
	if(response.status>=300 && ![301,302,307,308].includes(response.status)) {
		return 0;
	}
	if(response.status>400 && response.status!=404) {
		return 0;
	}
	const cachecontrol = (response.headers.get("cache-control")||"").toLowerCase(),
		expires = response.headers.get("expires");
	if(cachecontrol) {
		if(cachecontrol.includes("no-store") || cachecontrol.includes("private")) {
			return 0;
		}
		const parts = cachecontrol.split("=").map(item => item.trim());
		for(let i=0;i<parts.length;i++) {
			const part = parts[i];
			if(part.endsWith("max-age") || part.endsWith("s-maxage")) {
				return parseInt(parts[i+1])*1000;
			}
		}
	}
	if(expires) {
		try {
			return new Date(expires).getTime() - Date.now();
		} catch(e) {
			return 0;
		}	
	}
}

function isURL(url) {
	try {
		return !!new URL(url);
	} catch(e) {
		return false;
	}
}

const cachedir = "cache-storage";

class Cache extends AsyncStorage {
	constructor(cacheName) {
		super(`${cachedir}.${cacheName}`);
		delete this.storage;
		delete this.getItem;
		delete this.setItem;
		delete this.removeItem
	}
	get _storage() { } // make effectively private
	add(url) {
		if(!isURL(url)) {
			throw new TypeError(`cache.add expected url`);
		}
		fetch(url).then(function(response) {
			if (!response.ok) {
				throw new TypeError('bad response status');
	 		}
	  		return this.put(url,response);
		})
	}
	async delete(urlOrRequest,{ignoreSearch,ignoreMethod,ignoreVary}={}) {
		if(!isURL(urlOrRequest) && !Request.isRequest(urlOrRequest)) {
			throw new TypeError(`cache.put expected url or Request`);
		}
		let deleted = false;
		const url = typeof(urlOrRequest)==="string" ? urlOrRequest : urlOrRequest.url,
		// dummy up for now
			storage = await super.storage(),
			values = await storage.valuesWithKeyMatch(url);
		for(const {request} of values) {
			await storage.removeItem(request.url);
			deleted = true;
		}
		return deleted;
	}
	async keys() {
		const storage = await super.storage(),
			urls = await storage.keys(),
			keys = [];
		for(const url of urls) {
			const value = await storage.getItem(url);
			if(value && value.request) {
				keys.push(new Request(value.request.url,value.request));
			}
		}
		return keys;
	}
	async put(urlOrRequest,response) {
		if(!isURL(urlOrRequest) && !Request.isRequest(urlOrRequest)) {
			throw new TypeError(`cache.put expected url or coercible Request`);
		}
		if(!Response.isResponse(response,true)) {
			throw new TypeError(`cache.put expected Response or coercible to Response`)
		}
		const type = typeof(urlOrRequest),
			url = type==="string" ? urlOrRequest : urlOrRequest.url,
			request = await serializable(type==="string" ? new Request(urlOrRequest) : urlOrRequest),
			ttl = getTtl(response);
		if(ttl<=0) { // undefined would be ok
			return;
		}
		response = await serializable(response);
		return super.storage().then(storage => storage.setItem(url,{request,response},{ttl}));
	}
	async match(urlOrRequest,{ignoreSearch,ignoreMethod,ignoreVary}={}) {
		if(!isURL(urlOrRequest) && !Request.isRequest(urlOrRequest)) {
			throw new TypeError(`cache.put expected url or Request`);
		}
		const url = typeof(urlOrRequest)==="string" ? urlOrRequest : urlOrRequest.url;
		return super.storage().then(async (storage) => {
			const data = await storage.getItem(url);
			if(data) {
				return new Response(data.response.body,data.response);
			}
		})
	}
	async matchAll(urlOrRequest,{ignoreSearch,ignoreMethod,ignoreVary}={}) {
		if(!isURL(urlOrRequest) && !Request.isRequest(urlOrRequest)) {
			throw new TypeError(`cache.put expected url or Request`);
		}
		const url = typeof(urlOrRequest)==="string" ? urlOrRequest : urlOrRequest.url,
		// dummy up for now
			storage = await super.storage(),
			values = await storage.valuesWithKeyMatch(url);
		return values.map(({response}) => new Response(response.body,response))
	}
}

class CacheStorageInterface {
	async delete(cacheName) {
		if(await this.has(cacheName)) {
			await fs.rmdir(`${cachedir}.${cacheName}`,{recursive:true});
			return true;
		}
		return false;
	}
	async has(cacheName) {
		return new Promise((resolve,reject) => {
			const pattern = `${cachedir}.${cacheName}`;
			glob(pattern,(err,filenames) => {
				if(err) {
					reject(err);
				} else {
					resolve(filenames[0]===pattern);
				}
			})});
	}
	async keys() {
		return new Promise((resolve,reject) => {
			glob(`${cachedir}.*`,(err,filenames) => {
				if(err) {
					reject(err);
				} else {
					resolve(filenames.map(filename => filename.substring(cachedir.length+1)));
				}
			})});
	}
	async match(request,{ignoreSearch,ignoreMethod,ignoreVary,cacheName}) {
		const caches = cacheName ? [cacheName] : await this.keys();
		let matches = [];
		for(const cacheName of caches) {
			matches = matches.concat(await new Cache(cacheName).match({ignoreSearch,ignoreMethod,ignoreVary}))
		}
		return matches;
	}
	async open(cacheName) {
		return new Cache(cacheName);
	}
}
const CacheStorage = new CacheStorageInterface();

export {CacheStorage as default, CacheStorage, Cache}
module.exports = CacheStorage;
CacheStorage.CacheStorage = CacheStorage;
CacheStorage.Cache = Cache;
