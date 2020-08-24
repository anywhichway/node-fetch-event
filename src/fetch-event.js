/* This file is part of node-fetch-event. It is provided under GNU AFFERO GENERAL PUBLIC LICENSE, Version 3, 19 November 2007. Copyright (c) 2020 Simon Y. Blackwell */
class FetchEvent {
	constructor(config) {
		Object.assign(this,config);
		Object.defineProperty(this,"response",{writable:true});
		Object.defineProperty(this,"awaiting",{value:[]});
	}
	respondWith(f) {
		this.response = f(this);
	}
	waitUntil(promise) {
		this.awaiting.push(promise);
	}
}

export {FetchEvent as default, FetchEvent};
module.exports = { FetchEvent };