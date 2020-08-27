const storage = require('node-persist');

class _KVStore {
	constructor(name) {
		const store = storage.create({dir:name}),
			__storage = store.init().then(() => store);
		Object.defineProperty(this,"name",{get:()=>name});
		Object.defineProperty(this,"_storage",{get:()=>__storage});
	}
	async storage() {
		return this._storage;
	}
}

class KVStore extends _KVStore {
	constructor(name) {
		super(name);
	}
	get _storage() {
		return undefined; // make effectively private
	}
	async delete(key) {
		return super.storage().then(storage => storage.del(key));
	}
	async get(key) {
		return super.storage().then(storage => storage.get(key).then(({value}={}) => { return value; }));
	}
	async getWithMetadata(key) {
		return super.storage().then(storage => storage.get(key).then(({value,metadata={}}={}) => { return value===undefined ? undefined : {value,metadata}; }));
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
		return super.storage().then(storage => storage.set(key,{key,value,metadata,expiration},{ttl:expirationTtl*1000}));
	}
	async list({prefix="",limit,cursor}) {
		return super.storage().then(storage => storage.valuesWithKeyMatch(new RegExp(prefix+".*"))).then(results => results.map(({key,expiration,metadata}) => { return {name:key,expiration,metadata}; }));
	}
	storage() { }
}

export { KVStore as default, KVStore };
module.exports = KVStore;
KVStore.KVStore = KVStore;
