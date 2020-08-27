const message = "goodbye world!";

async function handleRequest(request) {
  const response = new Response(reverse(message));
	response.headers.set("content-type","text/html");
	return response;
}

const reverse = requireFromUrl("http://localhost:8082/reverse.js");

addEventListener("fetch",(event) => {
	event.respondWith(handleRequest(event.request));
})