const fs = require("fs"),
	path = require("path");

import { server } from "./server.js";

let options;
try {
	options = JSON.parse(fs.readFileSync(path.join(process.cwd(),"nfe.json")));
} catch(e) {
	options = JSON.parse(fs.readFileSync(path.join(__dirname,"nfe.json")));
}

function status({processId,maxWorkers,protocol,port,hostname,standalone,cacheWorkers,workerSource="file"}) {
	console.log(`Running node-fetch-event server processId:${processId} maxWorkers:${maxWorkers} cacheWorkers:${cacheWorkers} workerSource:${workerSource} standalone:${!!standalone} host:${protocol}://${hostname}${port ? ":"+port : ""}`)
}
server(options,status);