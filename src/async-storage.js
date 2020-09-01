"use strict"
var AsyncStorage;
if(typeof(require)==="undefined") {
	AsyncStorage = function AsyncStorage(name) {
		Object.defineProperty(this,"name",{get:()=>name});
		Object.defineProperty(this,"_storage",{get:()=>new Proxy(this,{get:(target,key) => typeof(AsyncStorage.prototype[key])==="function"  ? AsyncStorage.prototype[key].bind(this) : target[key] })});
	}
	AsyncStorage.prototype.getItem = async function(key) {
		const result =  localStorage.getItem(`${this.name}:${key}`);
		if(result!=null) {
			const json = JSON.parse(result);
			if(!json.ttl || json.ttl>Date.now()) {
				return json.value;
			}
		}
	}
	AsyncStorage.prototype.keys = async function() {
		const keys = [];
		for(let i=0;i<localStorage.length;i++) {
			const key = localStorage.key(i).substring(this.name.length);
			keys.push(key);
		}
		return keys;
	}
	AsyncStorage.prototype.removeItem =  async function(key) {
		return localStorage.removeItem(`${this.name}:${key}`)
	}
	AsyncStorage.prototype.setItem = async function(key,value,{ttl}) {
		if(ttl && typeof(ttl)==="object") {
			if(ttl instanceof Date) {
				ttl = ttl.getTime();
			} else {
				throw new TypeError(`asyncStorage.setItem expected tll to be a number or instanceof Date`)
			}
		}
		const expires = Date.now()+ttl;
		return localStorage.setItem(`${this.name}:${key}`,JSON.stringify({value,expires}))
	}
	AsyncStorage.prototype.storage = async function() {
		return this._storage;
	}
	AsyncStorage.prototype.valuesWithKeyMatch = async function(keyOrRegExp) {
		const type = typeof(keyOrRegExp);
		if(!keyOrRegExp && type!=="string" && type!=="object" && !(keyOrRegExp instanceof RegExp)) {
			throw new TypeError(`asynStorage.valuesWithKeyMatch expect string or RegExp`);
		}
		const values = [],
			match = type==="string" ? `${this.name}:${keyOrRegExp}` : new RegExp(`${this.name}\:${keyOrRegExp.source}`,keyOrRegExp.flags);
		for(let i=0;i<localStorage.length;i++) {
			const key = localStorage.key(i);
			if(match===key || (type==="object" && match.test(key))) {
				const result = localStorage.getItem(key);
				if(result!=null) {
					const json = JSON.parse(result);
					if(!json.expires || json.expires>Date.now()) {
						values.push(json.value);
					}
				}
			}
		}
		return values;
	}
} else {
	const storage = require('node-persist');
	AsyncStorage = function AsyncStorage(name) {
		const store = storage.create({dir:name}),
			__storage = store.init().then(() => store);
		Object.defineProperty(this,"name",{get:()=>name});
		Object.defineProperty(this,"_storage",{get:()=>__storage});
	}
	AsyncStorage.prototype.storage = async function() {
		return this._storage;
	}
}
export { AsyncStorage as default, AsyncStorage }
if(typeof(module)!=="undefined") {
	module.exports = AsyncStorage;
	AsyncStorage.AsyncStorage = AsyncStorage;
}