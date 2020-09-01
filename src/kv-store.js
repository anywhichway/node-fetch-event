import AsyncStorage from "./async-storage.js";

class KVStore extends AsyncStorage {
	constructor(name) {
		super(name);
	}
	async delete(key) {
		return super.storage().then(storage => storage.removeItem(key));
	}
	async get(key) {
		return super.storage().then(storage => storage.getItem(key).then(({value,expiration}={}) => { return typeof(expiration)==="number" && expiration*1000<=Date.now() ? undefined : value; }));
	}
	async getWithMetadata(key) {
		return super.storage().then(storage => storage.getItem(key).then(({value,expiration,metadata={}}={}) => { return value===undefined || (typeof(expiration)==="number" && expiration*1000<=Date.now()) ? undefined : {value,metadata}; }));
	}
	async put(key,value,{expiration,expirationTtl,metadata}={}) {
		if(typeof(expiration)==="number" && typeof(expirationTtl)==="number") {
			throw new Error("Set only one of expiration and expirationTtl, not both")
		}
		const now = Math.round(Date.now()/1000);
		if(typeof(expiration)==="number") {
			expirationTtl = expiration - now;
		}
		expiration = expirationTtl + now;
		const ttl = expirationTtl ? expirationTtl * 1000 : undefined;
		return super.storage().then(storage => storage.setItem(key,{key,value,metadata,expiration},{ttl}));
	}
	async list({prefix="",limit,cursor}) {
		return super.storage().then(storage => storage.valuesWithKeyMatch(new RegExp(prefix+".*"))).then(results => results.map(({key,expiration,metadata}) => { return {name:key,expiration,metadata}; }));
	}
	storage() { } // make effectively private
	get _storage() { } // make effectively private
	getItem() { }
	setItem() { }
	removeItem() { } 
}

export { KVStore as default, KVStore };
if(typeof(require)!=="undefined") {
	module.exports = KVStore;
	KVStore.KVStore = KVStore;
}
