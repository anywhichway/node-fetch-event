/* This file is part of node-fetch-event. It is provided under GNU AFFERO GENERAL PUBLIC LICENSE, Version 3, 19 November 2007. Copyright (c) 2020 Simon Y. Blackwell */
const http = require("http"),
	fetch = require("node-fetch"),
	deepcopy = require('deepcopy'),
	streamBuffers = require('stream-buffers');	
	
import Headers from './headers.js';
import Body from './body.js';
import ReadableStreamClone from 'readable-stream-clone';


function cloneBody(body) {
	const type = typeof(body);
	if(body && type==="object") {
		if(body instanceof Stream.Readable) {
			return new ReadableStreamClone(body)
		}
		if(body instanceof Stream.Writable) {
			return body;
		}
		return deepcopy(body);
	}
	return body;
}

const lock = (object={}) => {
	Object.entries(Object.getOwnPropertyDescriptors(object)).forEach(([[key,desc]]) => {
		if(desc.configurable) {
			desc.writable = false;
			desc.configurable = false;
			Object.defineProperty(object,key,desc);
		}
	})
}

class Response extends Body {
	constructor(input,{headers=input ? input.headers||{} : {},status=input ? input.status||200 : 200,statusText = input ? input.statusText : undefined}={}) {
		const type = typeof(input);
		if(input && type==="object") {
			if(input instanceof Response) {
				return input.clone();
			}
			if(input instanceof fetch.Response) {
				return new Response(cloneBody(input.body),clone);
			}
			if(input instanceof http.ServerResponse) {
				super(null);
				const responseheaders = input.getHeaders();
				headers = new Headers(responseheaders,input);
			} else {
				headers = new Headers(headers);
				super(input.body,{size:headers.get("content-length")||0});
			}
		} else if(input===undefined) {
			input = new streamBuffers.ReadableStreamBuffer({
   			 	initialSize: (1024),   // start at 1 kilobyte.
			    incrementAmount: (10 * 1024) // grow by 10 kilobytes each time buffer overflows.
			});
			headers = new Headers(headers);
			super(input);
			Object.defineProperty(this,"end",{configurable:true,writable:true,value:function(data) {
				if(this.writable) {
					if(this.nodeResponse) {
						this.nodeResponse.end(data);
						return;
					};
					this.body.stop();
					lock(this);
				}
			}});
			Object.defineProperty(this,"write",{configurable:true,writable:true,value:function(data) {
				if(this.writable) {
					this.nodeResponse ? this.nodeResponse.write(data) : this.body.put(data);
				}
			}})
		} else {
			headers = new Headers(headers);
			super(input);
		}
		Object.defineProperty(this,"internals",{value:{headers,status,statusText}});
		if(!this.writable) {
			lock(this);
		}
	}
	clone() {
		return new Response(cloneBody(this.body),this);
	}
	end(data) {
		if(this.writable) {
			if(this.nodeResponse) {
				this.nodeResponse.end(data);
				return;
			};
			this.body.stop();
			lock(this);
		}
	}
	get headers() {
		return this.internals.headers;
	}
	get status() {
		return this.nodeResponse ? this.nodeResponse.statusCode : this.internals.statusCode
	}
	get statusText() {
		return this.nodeResponse ? this.nodeResponse.statusMessage: this.internals.statusText
	}
	set status(code) {
		return this.nodeResponse ? this.nodeResponse.statusCode=code : this.internals.statusCode=code
	}
	set statusText(text) {
		return this.nodeResponse ? this.nodeResponse.statusMessage=text : this.internals.statusText=text
	}
	
	get writable() {
		const type = typeof(this.body);
		if(this.body && type==="object") {
			if(this.body instanceof streamBuffers.ReadableStreamBuffer) {
				return !this.body.stopped;
			}
			return this.body.writable;
		}
		return false;
	}
}

export { Response as default, Response };
module.exports = { Response };
