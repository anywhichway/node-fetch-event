async function handleRequest(request) {
  const response = new Response("hello world");
	response.headers.set("content-type","text/html");
	return response;
}

addEventListener("fetch",(event) => {
	event.respondWith(handleRequest(event.request));
})


