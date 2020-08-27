// no need to conditionalize if you are not worried about hosting on something other than `node-fetch-event`s server.
var MYKV = new KVStore("testkv");

async function handleRequest(request) {
	await MYKV.put("test",{test:1});
	const value = await MYKV.get("test");
	return new Response(JSON.stringify(value),{headers:{"content-type":"application/json"}})
}


addEventListener("fetch",(event) => {
	event.respondWith(handleRequest(event.request));
})