var chai,
	expect,
	fetch;
if(typeof(window)==="undefined") {
	chai = require("chai");
	expect = chai.expect;
	fetch = require("node-fetch").fetch;
} else {
	fetch = window.fetch;
	chai = window.chai;
	expect = window.expect;
}

const streamBuffers = require('stream-buffers');	
import KVStore from "../src/kv-store.js";
describe("KVStore",function() {
	let store;
	const expires = Math.round((Date.now()+1000)/1000);
	it("new",async () => {
		store = new KVStore("testkv");
		expect(store).to.be.instanceof(KVStore);
	})
	it("set/get",async () => {
		await store.put("test",{name:"test"},{expiration:expires,metadata:{secret:"test"}});
		const result = await store.get("test");
		expect(result.name).to.equal("test");
	});
	it("list",async () => {
		const result = await store.list({prefix:"te"});
		expect(result).to.be.instanceof(Array);
		expect(result.length).to.equal(1);
		expect(result[0].name).to.equal("test");
		expect(result[0].metadata.secret).to.equal("test");
		expect(result[0].expiration).to.equal(expires);
	})
	it("delete/get",async () => {
		await store.put("todelete",1);
		let result = await store.get("todelete");
		expect(result).to.equal(1);
		await store.delete("todelete");
		result = await store.get("todelete");
		expect(result).to.equal(undefined);
	});
	it("expiration",(done) => {
		setTimeout(async () => {
			const result = await store.get("test");
			expect(result).to.equal(undefined);
			done();
		},Math.max((expires * 1000) - Date.now(),0));
	}).timeout(5000)
});

import Headers from "../src/headers.js";
describe("Headers",function() {
	let headers;
	it("new",async () => {
		headers = new Headers({"content-length":64});
		expect(headers).to.be.instanceof(Headers);
	});
	it("has",async () => {
		const has = headers.has("content-length");
		expect(has).to.equal(true);
	});
	it("set",async () => {
		headers.set("content-length",128);
		const length = headers.get("content-length");
		expect(length).to.equal("128");
	});
	it("get",async () => {
		const type = headers.get("content-type");
		expect(type).to.equal(null);
	});
	it("delete",async () => {
		headers.delete("content-length");
		const length = headers.get("content-length");
		expect(length).to.equal(null);
	});
	it("append",async () => {
		headers.append("accept-headers","GET");
		headers.append("accept-headers","PUT");
		const accept = headers.get("accept-headers");
		expect(accept).to.equal("GET, PUT");
	});
});

import Request from "../src/request.js";
describe("Request",function() {
	let request;
	it("new - full URL, no options",async () => {
		request = new Request("http://localhost/index.html");
		expect(request).to.be.instanceof(Request);
		expect(typeof(request.url)).to.equal("string");
		expect(request.url).to.equal("http://localhost/index.html");
		expect(request.method).to.equal("GET");
		expect(request.headers).to.be.instanceof(Headers);
		expect(request.body).to.equal(null);
	});
	it("new - clone",async () => {
		request = new Request(request);
		expect(request).to.be.instanceof(Request);
	});
	it("new - invalid method with body",(done) => {
		try {
			const request = new Request("http://localhost/index.html",{method:"GET",body:1});
			expect(request).to.not.be.instanceof(Request);
		} catch(e) {
			done()
		}
	});
	it("new - with JSON body",async () => {
		const body = {test:"test"};
		request = new Request("http://localhost/index.html",{method:"PUT",body:JSON.stringify(body)});
		expect(request).to.be.instanceof(Request);
		expect(typeof(request.url)).to.equal("string");
		expect(request.url).to.equal("http://localhost/index.html");
		expect(request.method).to.equal("PUT");
		expect(request.headers).to.be.instanceof(Headers);
		const text = await request.text();
		expect(text).to.equal(JSON.stringify(body));
	});
	it("isRequest - instance", async () => {
		request = new Request("http://localhost/index.html");
		expect(Request.isRequest(request)).to.equal(true);
	})
	it("isRequest - relaxed", async () => {
		request = new Request("http://localhost/index.html");
		const object = Object.assign({},request);
		expect(Request.isRequest(object,true)).to.equal(true);
	})
	it("isRequest - by contructor", async () => {
		request = new Request("http://localhost/index.html");
		const object = Object.assign({},request);
		object.constructor = Request,
		expect(Request.isRequest(object)).to.equal(true);
	})
})

import Response from "../src/response.js";
describe("Response",function() {
	let response;
	it("new - null body",async () => {
		response = new Response(null);
		expect(response).to.be.instanceof(Response);
		expect(response.status).to.equal(200);
		expect(response.statusText).to.equal("");
		expect(response.headers).to.be.instanceof(Headers);
		const text = await response.text();
		expect(text).to.equal("");
	});
	it("new - clone",async () => {
		response = new Response(response);
		expect(response).to.be.instanceof(Response);
	});
	it("new - with text body",async () => {
		const body = "test";
		response = new Response(body);
		expect(response).to.be.instanceof(Response);
		const text = await response.text();
		expect(text).to.equal(body);
	});
	it("new - with JSON body",async () => {
		const body = {test:"test"};
		response = new Response(JSON.stringify(body));
		expect(response).to.be.instanceof(Response);
		const text = await response.text();
		expect(text).to.equal(JSON.stringify(body));
	});
	it("new - undefined body",async () => {
		response = new Response();
		expect(response.body).to.be.instanceof(streamBuffers.ReadableStreamBuffer);
	});
	it("new - writable body",async () => {
		const stream = new streamBuffers.WritableStreamBuffer();
		response = new Response(stream);
		expect(response.body).to.equal(stream);
	});
	it("isResponse - instance", async () => {
		response = new Response("test",{url:"http://localhost/index.html"});
		expect(Response.isResponse(response)).to.equal(true);
	})
	it("isResponse - relaxed", async () => {
		response = new Response("test",{url:"http://localhost/index.html"});
		expect(Response.isResponse(response.toJSON(),true)).to.equal(true);
	})
	it("isResponse - by contructor", async () => {
		response = new Response("test",{url:"http://localhost/index.html"});
		const object = Object.assign({},response);
		object.constructor = Response,
		expect(Response.isResponse(object)).to.equal(true);
	})
})

import {CacheStorage, Cache} from "../src/cache-storage.js";
describe("CacheStorage",function() {
	let store;
	const expires = Date.now()+1000;
	it("open",async () => {
		store = await CacheStorage.open("test");
		expect(store).to.be.instanceof(Cache);
	})
	it("has",async () => {
		const result = await CacheStorage.has("test");
		expect(result).to.equal(true);
	});
	it("has - fail",async () => {
		const result = await CacheStorage.has("test1");
		expect(result).to.equal(false);
	})
	it("keys",async () => {
		const keys = await CacheStorage.keys();
		expect(keys.length).to.equal(1);
		expect(keys[0]).to.equal("test");
	})
	it("put/match",async () => {
		const request = new Request("http://localhost/index.html"),
			response = new Response("test",{url:"http://localhost/index.html"});
		await store.put(request,response);
		const result = await store.match(request);
		expect(result).to.be.instanceof(Response);
	});
	it("get url/delete",async () => {
		let result = await store.match("http://localhost/index.html");
		expect(Response.isResponse(result,true)).to.equal(true);
		const deleted = await store.delete("http://localhost/index.html");
		expect(deleted).to.equal(true);
		result = await store.match("http://localhost/index.html");
		expect(result).to.equal(undefined);
	});
	it("expiration - expires",(done) => {
		const request = new Request("http://localhost/index.html"),
			response = new Response("test",{url:"http://localhost/index.html",headers:{"cache-control":"max-age=1"}});
		store.put(request,response);
		setTimeout(async () => {
			const result = await store.match("http://localhost/index.html");
			expect(result).to.equal(undefined);
			done();
		},2000);
	}).timeout(3000);
	it("expiration - not expires",(done) => {
		const request = new Request("http://localhost/index.html"),
			response = new Response("test",{url:"http://localhost/index.html",headers:{"cache-control":"max-age=10"}});
		store.put(request,response);
		setTimeout(async () => {
			const result = await store.match("http://localhost/index.html");
			expect(result).to.be.instanceof(Response);
			const test = await result.text();
			expect(test).to.equal("test");
			done();
		},2000);
	}).timeout(3000);
	it("delete",async () => {
		const result = await CacheStorage.delete("test");
		expect(result).to.equal(true);
	});
	it("delete - fail",async () => {
		const result = await CacheStorage.delete("test");
		expect(result).to.equal(false);
	});
	it("delete - fail (never existed)",async () => {
		const result = await CacheStorage.delete("test1");
		expect(result).to.equal(false);
	});
});
