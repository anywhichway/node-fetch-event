# node-fetch-event

The `node-fetch-event` library is an implementation of the [FetchEvent](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent) paradigm used 
by several severless function providers. It is an open source means of:

1) testing serverless functions in a local environment,

2) moving serverless functions to alternate hosting operations should the capabilities of the severless provider not meet the business
needs of the developer, e.g. memory or response time limits, access to additional `NodeJS` libraries, etc.

3) developing and hosting services from scratch using the `FetchEvent` pattern.

The libray includes support for [CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage) and [Cache](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage), 
[TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder), 
[TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder), 
[Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Crypto),
[atob](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/atob) and [btoa](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/btoa),
routes, 
data stores (including a built-in Cloudflare compatible KVStore), 
and importing/requiring almost any NodeJS module.

The library exposes the ability to control the idle time, heap, stack, code size, response time, and CPU usage allowed for any request response.

The code is currently in an BETA state and has not yet been tested on Windows.

[Acknowledgements](#acknowledgements)

[Installing](#installing)

[Writing Code](#writing-code)

[Running A Node Fetch Event Server](#running-a-node-fetch-event-server)

[Cache](#cache)

[Environment Variables and Data Stores](#environment-variables-and-data-stores)

[Routes](#routes)

[Security](#security)

[Internals](#internals)

[Release History](#release-history)

# Installing

`npm install node-fetch-event`

# Usage

The core functions behave as defined by Cloudflare:

1) [addEventListener](https://developers.cloudflare.com/workers/runtime-apis/add-event-listener)

2) [event.respondWith](https://developers.cloudflare.com/workers/runtime-apis/fetch-event#methods)

3) [event.waitUntil](https://developers.cloudflare.com/workers/runtime-apis/fetch-event#methods)

4) [event.passThroughOnException](https://developers.cloudflare.com/workers/runtime-apis/fetch-event#methods) is not supported. Use the global server option `workerFailureMode` instead.

## Writing Code

Write your worker code as you normally would, except conditionalize target environment variables if you wish to continue deployment to serverless hosts while also running in the `node-fetch-event` environment:

```javascript

// define vars for any items the target serverless environment may provide automatically
// for example, in Cloudflare this might be a KV store binding
var MYKV;

// define other variables you optionally need
var	process,
	reverse;
	

// conditionally bind varibales based on something that will not be in the normal target environment
// requireFromUrl is provided by node-fetch-event
if(typeof(requireFromUrl)!=="undefined") {

	MYKV = new KVStore("mykv"); // KVStore is a Cloudflare compatible local key-value store

	// if your target environment supports node modules, you can require them
	// the node-fetch-event server supports all NodeJS modules
	process = require("process");
	
	// you can also use remote modules, 
	reverse = requireFromUrl("http://localhost:8082/reverse.js");
}

async function handleRequest(request) {
	return new Response("hello world");
}

addEventListener("fetch",(event) => {
	event.respondWith(handleRequest(event.request));
})
```

## Running A Node Fetch Event Server

A server is provided as part of `node-fetch-event`. Just start it from the command line or require it and it will start running:

```
node -r esm ./node_modules/node-fetch-event/server.js
```

or

```javascript
require("node-fetch-event")()
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
	"maxServers": // default:1, maximum is automatically reduced to the number of cores on the computer where server is run
				  // strongly recommended to use 2 or more to have a cluster that will restart on errors
	"defaultWorkerName": // default:"worker", the default worker file name (without .js extension) for routes ending in /
	"cacheWorkers": // default:false, a new worker is loaded for every request,
					// if true (for production) the worker is cached after the first load,
					// if a number, assumes to be seconds at which to invalidate cache for a worker
					// can be overriden per route
	"workerSource": // optional, the host from which to serve workers, if not specifed tries files in `process.cwd()` and then `__directory`
	"workerFailureMode": "open" || "error" || "closed", 
					// default: open, returns a 500 error with no message, 
					// error returns a 500 error with Error thrown by worker, recommended while in BETA
					// closed (or any other value) never responds, requesting client may hang,
	"workerLimits": { // default resource limits for Workers, may be overriden at route level
		"maxAge": // optional, max cachng time before a new verson of the worker is loaded
		"maxIdle": 60000, // default: 1 minute, worker terminated if no requests in the period
		"maxTime": 15000, // default: 15 seconds ,overages abort the request
		"cpuUsage": 10, // default: 10ms, max CPU usage for an individual request, overages abort the request
		"maxOldGenerationSizeMb": 256 // default: 256mb,coverages abort the request
		"maxYoungGenerationSizeMb": 256 // default: 256mb, overages abort the request
		"stackSizeMb": 4, // default: 4 MB, overages abort the request
		"codeRangeSizeMb": 2, // default: 2mb, overages abort the request
	},
	"keys": // https cert and key paths or values {certPath, keyPath, cert, key}, not yet supported
	"kvStorage": // a storage engine class to put behind the built in KVStore class. Not yet implemented. Will support a remote, centralized, eventually consistent server.
	"routes": // default:"/", optional, maps paths to specific workers, if missing, the value of defaultWorkerName is loaded
			  // can also be a path or URL to a JSON file or a JavaScript file
}
```

One of the key advantages of FAAS providers is their CDNs or distributed hosting. If you have the resources to establish NodeJS servers in multiple locations, 
then you can effectively have your own CDN by designating one server to be the source of your workers in the `workerSource` option. The `node-fetch-server` 
will fetch new versions based on `maxAge` data in route specifications or `cacheWorkers`. 

HINT: If you set `cacheWorkers` to false during development, you will not have to restart your server when you change the worker code, just reload your browser.

Note: `workerFailureMode` may not work as expected during BETA. With clustering and Workers, the `node-fetch-event` server is very resilient to crashes, but they could occur.

## Cache

There is a `CacheStorage` implementaton as part of `node-fetch-event`. The `node-fetch-event` server always exposes `CacheStorage`, `Cache`, `caches` and `caches.default`.

`Cache` persists to disk as subdirectories of a the directory `__directory/cache-storage`. `Cache-Control` and `Expires` headers are respected.

`Caches` are shared across the server cluster and Workers.

In the current version of the BETA, the options `{ignoreSearch,ignoreMethod,ignoreVary}` are ignored. Only URL paths are matched.

## Environment Variables and Data Stores

In some cases, e.g. `Cloudflare`, your hosting provider will automatically add variables to your serverless function. If not, you will also need to conditionally add them.

The `node-fetch-event` server exposes `KVStore` with the same API as [Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/kv). However, in the BETA the
storage is just local to the server and the `limit` and `cursor` options to `list` are ignored.

```
var MYSECRET;
if(typeof(requireFromUrl)!=="undefined") {
	MYSECRET = "don't tell";
}

async function handleRequest(request) {
	return new Response(MYSECRET);
}

addEventListener("fetch",(event) => {
	event.respondWith(handleRequest(event.request));
})
```

```
// no need to conditionalize if you are not worried about hosting on something other than `node-fetch-event`s server.
var MYKV = new KVStore("testkv");

async function handleRequest(request) {
	await MYKV.put("test",{test:1});
	const value = await MYKV.get("test");
	return new Response(JSON.stringify(value),{headers:{"content-type":"application/json"}})
}

addEventListener("fetch",(event) => {
	event.respondWith(handleRequest(event.request));
})
```

## Response Pseudo Streaming

If a Response is created with an `undefined` value, the `Response` objects in `node-fetch-event` have the additional methods:

1) `write`

2) `end`

These DO NOT immediately stream to the client. Internally, the `Response` creates a readable stream on 
a buffer into which data is pushed by `write` and `end`. This can be conveniently processed by the standard body reading methods.

Note: Use `new Response()` or `new Response(undefined,options)` not `new Response(null)` to get this behavior.

You can also create `Responses` with writable streams. When returned by `respondWith`, the stream is considered complete and the buffer underlying 
the stream is written to the client. Continued attempts to write to the buffer will result in illdefined behavior.

## Routes

Routing is not strictly part of the `FetchEvent` paradigm, but you may need to be able to invoke different workers based on different requests; hence, a router is provided.

The server route specification is an object the keys of which are pathnames or methods to match the request URL. (Query strings are not used in the match for the BETA). The keys can contain substitution variables denoted 
by `:` like most routers. The route keys can also be regular expressions starting with "/" and ending with "/". Options flags are not supported. Ambiguity with path naming conventions and slashes is addressed by 
explicit path testing first, followed by trying the same key as a regular expression. Errors in this second test are simply ignored.

For basic use and route specification using just a JSON file, the values are objects that define the context in which a worker can run. They have the surface 
`{path,useQuery,maxAge,timeout,maxIdle,maxTime,cpuUsage,maxOldGenerationSizeMb,maxYoungGenerationSizeMb,stackSizeMb,codeRangeSizeMb}`. For
advanced use where the route specification file is JavaScript, see [advanced routes](#advances-routes).

`path` - can be relative to the directory from which the server is running, or a remote URL.

`useQuery` - a boolean, if true tells the server to parse query string values into parameters to pass to the Worker. See [Routes and Query Strings](#routes-and-query-strings).

See the [server options documentation](#server-options), `workerLimits`, for definitions of other route options.

Here is a basic example:

```javascript
{
	"/": {
		"path": "/worker.js"
	},
	"/hello": {
		"path": "/worker.js"
	},
	"/bye": {
		// workers can be at remote URLs, which overrides workerSource startup option
		"path": "http://localhost:8082/goodbye.js",
		// get a new copy of the worker after ms, the server option `cacheWorkers` must be set to true or a number (which this overrides)
		"maxAge": 36000,
		// return a timeout error to client after ms
		"maxTime": 2500,
		 // stop if no requests recieved for ms, e.g. one minute
		"maxIdle": 60000
	}
}
```

Here is an example with a regular expression:


```javascript
{
	"/": {
		"path": "/worker.js"
	},
	"/\/hello.*/": { // starts with hello
		"path": "/worker.js"
	},
	"/\/bye.*/": { // starts with bye
		"path": "/goodbye.js",
	}
}
```

Route values can be selected based on the lowercase form of the request method:

```javascript
{
	"/": {
			"get": {
				"path": "worker"
			}
		},
	"/\/hello.*/": {
		"path": "worker"
	},
	"/\/bye.*/": {
		"path": "http://localhost:8082/goodbye.js",
		"maxAge": 36000
	}
}
```

Top level route selection can also be based on the lowercase form of the request method:

```javascript
{
	"get": {
		"/": {
			"path": "/worker.js"
		},
		"/\/hello.*/": {
			"path": "worker"
		},
		"/\/bye.*/": {
			"path": "http://localhost:8082/goodbye.js",
			"maxAge": 36000
		}
	}
}
```

Method selection takes precedence over path matching, so the first route below will never match in the case of "GET". Likewise, "DELETE" will never match the second route value.

```javascript
{
	"/": {
		"path": "/worker.js"
	},
	"get": {
		"/\/hello.*/": {
			"get": {
				"path": "worker",
			},
			"delete": {
				"path": "otherworker",
			}
		},
		"/\/bye.*/": {
			"path": "http://localhost:8082/goodbye.js",
			"maxAge": 36000
		}
	}
}
```

### Routes and Query Strings

Query strings from the `Request` be parsed and passed to the worker as an object value of the `Request` property `params`, so long as `useQuery` is set to true. 
The `useQuery` option exists to prevent the use of query strings as attack vectors.

The routes:

```javascript
{
	"/message": {
		"useQuery": true,
	}
}
```

The worker at /message:

```javascript
async function handleRequest(request) {
  const response = new Response(request.params.content);
	response.headers.set("content-type","text/html");
	return response;
}

addEventListener("fetch",(event) => {
	event.respondWith(handleRequest(event.request));
})
```

The request URL:

```html
http://localhost:3000/message?content=goodbye
```

Will invoke the worker with the Request object:


```javascript
{
	"url": "http://localhost:3000/?content=goodbye",
	"params": {
		"message": "goodbye"
	}
}
```

Attempts are made to parse the query strings with `JSON.parse`, so numbers will actually be numbers, booleans are boolean and even `{}` or `[]` delimited 
things will be objects and arrays. Note: For objects and arrays you will need to quote properties.

### Parameterized Routes

Routes can also contain parameters to serve as defaults, e.g.:

```javascript
{
	"/message/:content": {
		"path": "message.js",
		"params":{"content":"hello world"}
	}
}
```

The values in a the client query string will take priority over parameters from the route.

The request URL:

```html
http://localhost:3000/message
```

Will invoke the worker with the Request object:


```javascript
{
	"url": "http://localhost:3000/message",
	"params": {
		"message": "hello world"
	},
	... other properties ...
}
```

### Advanced Routes

When loaded from a JavaScript file, route values can also be arrays of functions that behave like `Express` routes, except that `next()` can also take 
a worker specification as an argument in addition to nothing or 'route'. Alternatively, the array elements can be async functions that
resolve to 'route', a worker specification, or undefined.

Here is a standard route:

```javascript

{
	"/myroute": [ (req,res,next) => { res.write("not done); next(); },(req,res) => res.end("done") ]
}
```

Here is a worker route as an array of Express route functions:

```javascript

{
	"/myroute": [ (req,res,next) => { if(securityCheck(request)) { next(); } else { next('route'); } },(req,res,next) => next({...someWorkerSpec}) ]
}
```

Here is the same route using async functions. There is no need to remember to call `next()`!:

```javascript

{
	"/myroute": [ async (req,res) => { if(!securityCheck(request)) return 'route' },async (req,res) => {...someWorkerSpec} ]
}
```

When a worker specification is invoked via `next` or returned by an async route function, no writes to the response body should have occured. If a write
has occured, an error will be thrown. If there are any functions after the one that calls `next` with the worker spec, 
the `Response` they receive will be the one created by the worker. Additionally, at this point the route is committed
and calling `next('route')` will abort processing but NOT continue to the next route. Typically, the function calling
the worker will be the last in the chain. There can only be ONE worker call in a route.

## Security

Because the `fetch-event` server exposes the capability to load routes, worker configurations, and worker code from URLs, you should ensure
that you control the source server for routes and worker configurations. Theoretically, the isolation created through the use of both a cluster server
and worker threads should sufficiently isolate worker code so that you can load modules via URLs from friendly servers that you may not control. However,
this is currently BETA software and caution should be used.

The [webcrypto](https://github.com/nodejs/webcrypto) library used to support `crypto` in the workers is considered experimental by its author.

## Internals

Internally, the `node-fetch-event` server isolates the execution of requested routes to Node `worker_threads` and runs it's http(s) request handler 
using Node `cluster`.

## Acknowledgements

In addition to the dependencies in `package.json`, portions of this library use source code from the stellar [node-fetch](https://www.npmjs.com/package/node-fetch).

## Release History (reverse chronological order)

2020-09-11 v0.0.4b Documentation updates. Router enhancements. Extracted worker code into service-worker.js file. Deprecated support for query string paramegters in
a route definition for default. Use `params` instead. Query strings in route paths can now be used by remnote servers to configure the route source. Workers can now be
pipelined in routes.

2020-09-09 v0.0.3b Documentation updates. Router enhancements.

2020-09-01 v0.0.2b Documentation updates.

2020-09-01 v0.0.1b Added unit tests. Fully implemented `CacheStorage` with exception of `{ignoreSearch,ignoreMethod,ignoreVary}`.

2020-08-31 v0.0.7a Added unit tests and fixed numerous issues as a result. 
	Add CacheStorage. Eliminated setting backing store for `Cache` (for now).
	Added WriteableStream support to Response.
	Removed standalone option. Clustering is automatic if maxServers>=2, otherwise standalone
	Headers now properly returned by Workers
	Worker limits at server now properly set default and can be overriden by routes
	Anticipate this is the final ALPHA

2020-08-27 v0.0.6a Added additional missing imports for each worker, e.g. atob, TextEncoder, crypto, etc.

2020-08-27 v0.0.5a Added KVStore. Improved documentation.

2020-08-26 v0.0.4a Improved routing

2020-08-26 v0.0.3a Simplified stylized coding. Made workers into threads. Added regular expression routes. Removed streaming.

2020-08-24 v0.0.2a Added route and cache support

2020-08-24 v0.0.1a First public release