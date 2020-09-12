import { Response } from "./response.js";

const AsyncPrototype = Object.getPrototypeOf(async ()=>{});

function extractParams(pattern,pathname) {
	const patternparts = pattern.split("/"),
		pathparts = pathname.split("/"),
		params = {};
	if(patternparts.length===pathparts.length) {
		for(let i=0;i<patternparts.length;i++) {
			const pattern = patternparts[i],
				pathpart = pathparts[i];
			if(pattern.startsWith(":")) {
				const key = pattern.substring(1);
				try {
					params[key] = JSON.parse(pathpart);
				} catch (e) {
					params[key] = pathpart;
				}
				continue;
			} else if(pattern===pathpart) {
				continue;
			} else if(pattern.startsWith("/") && pattern.endsWith("/")) {
				try {
					if(new RegExp(pattern.substring(1,pattern.length-1).test(pathpart))) {
						continue;
					}
				} catch(e) {
					return;
				}
			}
			return;
		}
		return params;
	}
}

async function route(toMatch,request,response,serviceWorkerFactory,aroute) {
	const type = typeof(toMatch),
		url = new URL(request.url),
		method = request.method.toLowerCase();
	if(type==="string") {
		if(toMatch==="*") {
			if(url.pathname.endsWith("/")) {
				return aroute ? aroute[method]||aroute : (await serviceWorkerFactory.get(url.pathname + serviceWorkerFactory.defaultWorkerName)).run(request,response);
			}
			return aroute ? aroute[method]||aroute : (await serviceWorkerFactory.get(url.pathname)).run(request,response);
		}
		const params = extractParams(toMatch,url.pathname); // will only succeed if there is a path match
		if(params) {
			const requestcopy = request.clone();
			requestcopy.params = params;
			let result;
			if(aroute) {
				if(Array.isArray(aroute)) {
					for(let i=0;i<aroute.length;i++) {
						const f = aroute[i];
						result = Object.getPrototypeOf(f)===AsyncPrototype ? await f(requestcopy,response) : await new Promise((resolve) => f(requestcopy,response,resolve));
						if(result==="route") {
							return;
						}
						if(result && typeof(result)==="object") {
							const options = Object.assign({},serviceWorkerFactory.options,result);
							delete options.path;
							response = await (await serviceWorkerFactory.get(result.path || url.pathname,options)).run(requestcopy,response);
						}
					}
					return response;
				} else if(aroute[method]) {
					return route(toMatch,request,response,serviceWorkerFactory,aroute[method]);
				} else {
					result = aroute;
				}
			}
			if(typeof(result)==="function") {
				return aroute(requestcopy,response)
			}
			result || (result = {});
			return (await serviceWorkerFactory.get(result.path || url.pathname)).run(requestcopy,response);;
		}
	} else if(toMatch && type==="object") {
		if(toMatch[method]) {
			toMatch = toMatch[method]
		}
		for(const key in toMatch) {
			if(key.startsWith("/")) {
				const result = await route(key,request,response,serviceWorkerFactory,toMatch[key]);
				if(result) {
					return result;
				}
			}
		}
		return new Response(null,{status:404,statusText:"Not Found"});
	}
}

export {route as default, route}
module.exports = { route }