const http = require("http");

import Request from "./src/request.js";
import Response from "./src/response.js";

http.createServer(async (req,res) => {
	console.log(new Request(req)),
	console.log(res = new Response(res));
	console.log(new Response(undefined))
	const r = new Response();
	r.end("test");
	console.log(await r.text())
	res.end("hello world")
}).listen(3001)