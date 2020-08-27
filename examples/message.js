async function handleRequest(request) {
  const response = new Response(request.params.content);
	response.headers.set("content-type","text/html");
	return response;
}

addEventListener("fetch",(event) => {
	event.respondWith(handleRequest(event.request));
})

