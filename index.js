const fs = require("fs"),
	path = require("path");

import { server } from "./server.js";

let options;
try {
	options = JSON.parse(fs.readFileSync(path.join(process.cwd(),"nfe.json")));
} catch(e) {
	options = JSON.parse(fs.readFileSync(path.join(__dirname,"nfe.json")));
}

function status({processId,maxWorkers,protocol,port,hostname,standalone}) {
	console.log(`Running node-fetch-event server processId:${processId} maxWorkers:${maxWorkers} standalone:${!!standalone} ${protocol}://${hostname}${port ? ":"+port : ""}`)
}
server(options,status);