async function handleRequest(request) {
  const response = new Response("hello world");
	response.headers.set("content-type","text/html");
	return response;
}

const main = ({addEventListener,caches,fetch,Response,Request}) => {
	addEventListener("fetch",(event) => {
		const response = event.response;
		if(response) {
			response.headers.set("content-type","text/html");
			response.end("hello world");
			return response;
		}
		event.respondWith(handleRequest(event.request));
	})
}

if(typeof(addEventListener)!=="undefined") {
	var caches; // for Cloudflare
	main({addEventListener,caches,fetch,Response,Request});
} else {
	module.exports = (scope) => main(scope);
}
