const fs = require("fs"),
	path = require("path");

import { server } from "./index.js";

let options;
try {
	options = JSON.parse(fs.readFileSync(path.join(process.cwd(),"nfe.json")));
} catch(e) {
	options = JSON.parse(fs.readFileSync(path.join(__dirname,"nfe.json")));
}

function status({processId,maxServers,protocol,port,hostname,defaultWorkerRoot}) {
	console.log(`Running node-fetch-event server processId:${processId} maxServers:${maxServers} defaultWorkerRoot:${defaultWorkerRoot} host:${protocol}://${hostname}${port ? ":"+port : ""}`)
}
server(options,status);