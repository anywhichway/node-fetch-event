# node-fetch-event

The `node-fetch-event` library is an implementation of the [FetchEvent](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent) paradigm used by several severless function providers. It is intended
to serve as an open source means of:

1) testing such functions in a local environment,

2) moving such functions to alternate hosting operations should the capabilities of the severless provider not meet the business
needs of the developer, e.g. memory or response time limits, access to additional `NodeJS` libraries, etc.

The code is currently in an ALPHA state.

# Installing

`npm install node-fetch-event`

# Usage

The core functions behave, at a minimum, as one would expect:

1) addEventListener

2) event.responsdWith

3) event.waitUntil

## Writing Code

Write your code as you normally would, except provide a stylized `main` function in order to ensure it can continue to be deployed to serverless hosts while also running in the `node-fetch-event` environment:

```javascript
async function handleRequest(request) {
	return new Response("hello world");
}

const main = ({addEventListener,fetch,Response,Request}) => {
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
	// running in a serveless environnent that provides core functions and classes
	main({addEventListener,fetch,Response,Request});
} else {
	// export the main function, the node-fetch-event server will use this
	module.exports = (scope) => main(scope);
}
```

## Running A Note Fetch Event Server

A server is provided as part of `node-fetch-event`, just start it from the command line or require it and it will start running:

```javascript
node -r esm ./node_modules/node-fetch-event/index.js
```

or

```javascript
require("node-fetch-event/server.js")()
```

or

```javascript
import {server} from "node-fetch-event";
server();
```


By default the server runs on `http://localhost:3000` and looks for a `worker.js` file in the directory from which is was launched. So if you have the
example code above in `worker.js` and type `http://localhost:3000` into a browser you will see `hello world`.

### Server Options

Of course, you can provide options to control the server, e.g. `server(options)`. They have the surface:

```javascript
{
	"protocol": "http" || "https" // https not yet supported
	"hostname": // defaults to localhost
	"port": // defaults to 3000
	"maxWorkers": // default:1, maximum is automatically reduced to the number of cores on the computer where it is run
	"standalone": // default:false (a cluster is created), use true to create a stanalone server that will shutdown (crash) on errors
	"worker": // default:worker.js, the default worker file name for routes ending in /
	"routes": // default:"/", optional, maps paths to specific workers, if missing, the value of worker is loaded
	"cacheWorkers": // default:false, a new worker is loaded for every request,
					// if true (for production) the worker is cached after the first load,
					// if a number, assumes to be seconds at which to invalidate cache for a worker
					// can be overriden per route
	"workerSource": // optional the host from which to serve workers, if not specifed first looks in `process.cwd()` and then `__directory`
	"keys": // https cert and key paths or values {certPath, keyPath, cert, key}, not yet supported
	"cacheStorage": // a storage engine to put behind the built in Cache class, the default is an in memory Map. Not yet implemented.
}
```

#### Routes

The server route specification is an object the keys of which are pathnames to match the request URL and values objects with the surface `{path,ttl}`, for example:

```javascript
{
	"/": {
		"path": "/worker.js"
	},
	"/hello": {
		"path": "/worker.js"
	},
	"/bye": {
		"path": "/goodbye.js",
		"ttl": 36000
	}
}
```

Regular expression matches are on the way. There are also plans to read Clouflare wrangler and other configuration files for routes.

## Accessing Additional Features

### Cache

There is a `Cache` implementaton as part of `node-fetch-event`. To use it, expose it via to your main function. The `node-fetch-event` server always exposes `Cache` and `caches`.

```javascript
if(typeof(addEventListener)!=="undefined") {
	main({addEventListener,fetch,Response,Request,Cache,caches});
} else {
	module.exports = (scope) => main(scope);
}

```

### Environment Variables and Data Stores

To expose environment variables, which may be bound to data stores and other things, add them to the items exposed by the `node-fetch-event` server. In some cases, e.g. `Cloudflare`, your
hosting provider will automatically add them to your serveles function. If, not, you will also need to add them.


if(typeof(addEventListener)!=="undefined") {
	main({addEventListener,fetch,Response,Request,Cache,caches});
} else {
	const myVariables = {
		mySecret: "I can't tell you!",
		myDataBase: new KVStore(); // you need to provide an implementation, it could be MongoDB or a MongoDB wrapper so long as your worker code uses the correct calls.
	}
	module.exports = (scope) => main(Object.assign({},scope,myVariables));
}

## Node Fetch Event Extensions

The `Response` objects in `node-fetch-event` have the additional methods, if a Response is created with an `undefined` value:

1) `write`

2) `end`

Note: Use `new Response()` or `new Response(undefined,options)` not `new Response(null)` to get this behavior. Internally, the Response creates a readable stream on a buffer into which data is pushed
by `write` and `end`. This can be conveniently processed by the standard body reading methods.

The `FetchEvent` has an additional property `request`. If this `request` is used directly it will stream headers and writes to the original underlying NodeJS response object. This allows for
faster client updates. If a different response (including a clone) is returned, then the cotents of the body and headers are streamed to the client when `respondWith` returns. If there is
a flaw in your code and you return a different response after alreayd starting to send on the original, an error is thrown (but if you did not start the server in `standalone` mode the
cluster will continue serving other workers).

## Remote Worker Source

One of the key advantages of FAAS providers is their CDNS. If you have the resources to establish NodeJS servers in multiple locations, then you can effectively have your own CDN by designating one server
to be the source of your workers. The `node-fetch-server` will fetch new versions based on TTL data in route specifications or `cacheWorkers`. 

## Release History (reverse chronological order)

2020-08-24 v0.0.2a Added route and cache support

2020-08-24 v0.0.1a First public release