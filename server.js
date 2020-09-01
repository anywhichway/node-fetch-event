const fs = require("fs"),
	path = require("path");

import { server } from "./index.js";

let options;
try {
	options = JSON.parse(fs.readFileSync(path.join(process.cwd(),"nfe.json")));
} catch(e) {
	options = JSON.parse(fs.readFileSync(path.join(__dirname,"nfe.json")));
}

function status({processId,maxServers,protocol,port,hostname,cacheWorkers,workerSource="file"}) {
	console.log(`Running node-fetch-event server processId:${processId} maxServers:${maxServers} cacheWorkers:${cacheWorkers} workerSource:${workerSource} host:${protocol}://${hostname}${port ? ":"+port : ""}`)
}
server(options,status);