import { KVStore } from "../src/kv-store.js";

const store = new KVStore("testkv");

store.put("test",{test:"test"},{expirationTtl:100,metadata:{secret:"test"}})
	.then(async () => console.log(await store.get("test")))
	.then(async () => console.log(await store.getWithMetadata("test")))
	.then(async () => console.log(await store.list({prefix:"test"})))
	.then(() => console.log(store))
	.then(() => store.delete("test"));
	
	store.put("a/b",{test:"a/b"});
