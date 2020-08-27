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

function route(toMatch,request,worker,aroute) {
	const type = typeof(toMatch),
		url = new URL(request.url),
		method = request.method.toLowerCase();
	if(type==="string") {
		if(toMatch==="*") {
			if(url.pathname.endsWith("/")) {
				return aroute ? aroute[method]||aroute : {path:url.pathname + worker};
			}
			return aroute ? aroute[method]||aroute : {path:url.pathname};
		}
		const params = extractParams(toMatch,url.pathname);
		if(params) {
			if(aroute) {
				if(aroute[method]) {
					return Object.assign({},aroute[method],{params});
				}
				return Object.assign({},aroute,{params})
			}
			return {path:url.pathname,params}
		}
	} else if(toMatch && type==="object") {
		if(toMatch[method]) {
			toMatch = toMatch[method]
		}
		for(const key in toMatch) {
			if(key.startsWith("/")) {
				const match = route(key,request,worker,toMatch[key]);
				if(match) {
					return match;
				}
			}
		}
	}
}

export {route as default, route}
module.exports = { route }