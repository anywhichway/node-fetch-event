/* This file is part of node-fetch-event. It is provided under GNU AFFERO GENERAL PUBLIC LICENSE, Version 3, 19 November 2007. Copyright (c) 2020 Simon Y. Blackwell */
const http = require("http");

import ReadableStreamClone from "readable-stream-clone";

import Headers from "./headers.js";
import Body, {getTotalBytes} from "./body.js";

class Request extends Body {
	static isRequest(request,relaxed) {
		if(!request || typeof(request)!=="object") {
			return false;
		}
		if(relaxed && typeof(request.url)==="string" && typeof(request.method)==="string" && Headers.isHeaders(request.headers,relaxed)) {
			return true;
		}
		return request instanceof Request || request.constructor.name==="Request";
	}
	constructor(input, init = {}) {
		const type = typeof(input);
		
		if(input && type==="object") {
			if(input instanceof Request) {
				return input.clone();
			}
			if(input instanceof http.IncomingMessage) {
				const options = getNodeRequestOptions(input),
					host = options.headers.get("host"),
					protocol = input.socket.encrypted ? "https" : "http",
					url = (new URL(`${protocol}://${host}${input.url}`))+"",
					instance = new Request(url,options);
				Object.defineProperty(instance,"socket",{value:input.socket});
				return instance;
			}
		}
		
		
		const options =  {};
		
		options.url = new URL(input)+"";

		options.method = (init.method || "GET").toUpperCase();
		
		options.headers = new Headers(init.headers||{});
		
		if ((init.body != null) && (options.method === "GET" || options.method === "HEAD" || options.method === "OPTIONS")) {
			throw new TypeError("Request with GET/HEAD/OPTIONS method cannot have body");
		}
		
		let contentLengthValue = null;
		if (init.body == null && /^(post|put)$/i.test(options.method)) {
			contentLengthValue = "0";
		}
	
		if (init.body != null) {
			const type = typeof(init.body);
			options.body = type==="object" && init.body instanceof Stream ? new ReadableStreamClone(init.body) : init.body;
			const totalBytes = getTotalBytes(init);
			if (typeof totalBytes === "number" && !Number.isNaN(totalBytes)) {
				contentLengthValue = String(totalBytes);
			}
		}
	
		if (contentLengthValue) {
			headers.set("Content-Length", contentLengthValue);
		}
		
		super(options.body===undefined ? null : options.body, {
			size: init.size || 0
		})
		
		// makw this more specific
		Object.entries(options).forEach(([key,value]) => key==="body" || Object.defineProperty(this,key,{enumerable:true,value}))
	}
	clone() {
		return new Request(this.url,this);
	}
	toJSON() {
		const object = {};
		Object.entries(this).forEach(([key,value]) => value==null || (object[key] = value.toJSON ? value.toJSON() : value));
		return object;
	}
}


Object.defineProperties(Request.prototype, {
	method: {enumerable: true},
	url: {enumerable: true},
	headers: {enumerable: true},
	redirect: {enumerable: true},
	referrer: {enumerable: true},
	referrerPolicy: {enumerable: true},
	clone: {enumerable: true},
	signal: {enumerable: true}
});


const getNodeRequestOptions = request => {
	
	const method = request.method;
	
	const headers = new Headers(request.headers);
	
	const body = request.body ? new ReadableStreamClone(request.body) : undefined;
	
	const mode = headers.get("sec-fetch-mode")

	const referrer = headers.get("referer")||headers.get("referrer")||"no-referrer";
	
	const referrerPolicy =  headers.get("referrer-policy")||"no-referrer-when-downgrade";
	
	const redirect = "follow";

	return {method, headers, body, mode, referrer, referrerPolicy, redirect};
};

export { Request as default, Request, getNodeRequestOptions};
module.exports = { Request, getNodeRequestOptions };

