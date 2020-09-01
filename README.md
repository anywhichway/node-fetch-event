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

The code is currently in an BETA state.

[Acknowledgements](#acknowledgements)

[Installing](#installing)

[Writing Code](#writing-code)

[Running A Node Fetch Event Server](#running-a-node-fetch-event-server)

[Routes](#routes)

[Cache](#cache)

[Environment Variables and Data Stores](#environment-variables-and-data-stores)

[Internals](#internals)

[Release History](#release-history)

# Installing

`npm install node-fetch-event`

# Usage

The core functions behave as defined below:

1) [addEventListener](https://developers.cloudflare.com/workers/runtime-apis/add-event-listener)

2) [event.respondWith](https://developers.cloudflare.com/workers/runtime-apis/fetch-event#methods)

3) [event.waitUntil](https://developers.cloudflare.com/workers/runtime-apis/fetch-event#methods)

4) [event.passThroughOnException](https://developers.cloudflare.com/workers/runtime-apis/fetch-event#methods) is not supported. Use the gloabl server option `workerFailureMode` instead.

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
	const response = event.response;
	if(response) {
		response.headers.set("content-type","text/html");
		response.end("hello world");
		return response;
	}
	event.respondWith(handleRequest(event.request));
})
```

## Running A Node Fetch Event Server

A server is provided as part of `node-fetch-event`. Just start it from the command line or require it and it will start running:

```javascript
node -r esm ./node_modules/node-fetch-event/server.js // index
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
	"routes": // default:"/", optional, maps paths to specific workers, if missing, the value of worker is loaded
	"defaultWorkerName": // default:worker, the default worker file name (without .js extension) for routes ending in /
	"cacheWorkers": // default:false, a new worker is loaded for every request,
					// if true (for production) the worker is cached after the first load,
					// if a number, assumes to be seconds at which to invalidate cache for a worker
					// can be overriden per route
	"workerSource": // optional, the host from which to serve workers, if not specifed assumes files in `process.cwd()` and then `__directory`
	"workerFailureMode": open || error || closed, 
					// default: open, returns a 500 error with no message, 
					// error returns a 500 error with Error thrown by worker, 
					// closed (or any other value) never responds, requesting client may hang,
	"workerLimits": { // default resource limits for Workers, may be overriden at route level
		"maxAge": // optional, max cachng time before a new verson of the worker is loaded
		"maxIdle": 60000, // default: 1 minute, worker terminated if no requests in the period
		"maxTime": 15000, // default: 15 seconds ,overages abort the request
		"cpuUsage": 10, // default: 10ms, max CPU usage for an individual request, overages abort the request
		"maxOldGenerationSizeMb": 256 // default: 256mb ,overages abort the request
		"maxYoungGenerationSizeMb": 256 // default: 256mb ,overages abort the request
		"stackSizeMb": 4, // default: 4 MB??, overages abort the request
		"codeRangeSizeMb": 2, // default: 2mb,  ,overages abort the request
	},
	"keys": // https cert and key paths or values {certPath, keyPath, cert, key}, not yet supported
	"cacheStorage": // a storage engine class to put behind the built-in Cache class, the default is a local file system store.
	"kvStorage": // a storage engine class to put behind the built in KVStore class. Not yet implemented. Will support a remote centralized server.
}
```

One of the key advantages of FAAS providers is their CDNs or distributed hosting. If you have the resources to establish NodeJS servers in multiple locations, 
then you can effectively have your own CDN by designating one server to be the source of your workers in the `workerSource` option. The `node-fetch-server` 
will fetch new versions based on `maxAge` data in route specifications or `cacheWorkers`. 

HINT: If you set `cacheWorkers` to false during development, you will not have to restart your server when you change the worker code, just reload your browser.

Note: `workerFailureMode` may not work as expected during BETA. With clustering and Workers, the `node-fetch-event` server is very rresilibe to crashes, but they could occur.

## Routes

The server route specification is an object the keys of which are pathnames to match the request URL and values, objects with the surface `{path,maxAge,timeout,maxIdle,useQuery}`. The `maxAge` 
property is in seconds and tells the server how long it can cache the worker. The `timeout` is in miliseconds and tells the server how long it should wait for a response
prior to return an error to the client. The `maxIdle` is how long the server should let a worker be idle before stopping it. THe `useQuery` flag tells the server to parse quiery string values 
into parameters to pass to the Worker. For example:

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

The route keys can also be regular expressions starting with "/" and ending with "/". Options flags are not supported. Ambiguity with path naming conventions and slashes is addressed by 
explicit path testing first, followed by trying the same key as a regular expression. Errors in this second test are simply ignored.

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

Query strings will be parsed and passed to the worker as an object value for special a property on the Request object, `params` so long as `useQuery` is set to true. The route path can provide 
defaults with the originally requested path providing the primary values, e.g.:

The routes:

```javascript
{
	"/message": {
		"useQuery": true,
		"path": "/message?content=hello world"
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

Attempts are made to parse the query strings with `JSON.parse`, so numbers will actually be numbers, booleans are boolean and even `{}` or `[]` delimited things will be objects and arrays. Note: For obejcts and
arrays you will need to quote propertys and values.

It is also possible to just use the route query string for passing parameters without setting `useQuery` to true. This is made possible because it is assumed you have complete control over the route
file, whereas you may want to explicilty exclude client query strings as an attack vector.


```javascript
{
	"/message": {
		"path": "/message?mySecret=45hyskde!"
	}
}
```

### Parameterized Routes

Routes can also contain parameters, e.g.:

```javascript
{
	"/message/:content": {
		"path": "/message"
	}
}
```

The values in a the client query string will take priority over those from the route. The value in a route query string (as the defaults) will be ignored if set by parameter parsing.


## Cache

There is a `CacheStorage` implementaton as part of `node-fetch-event`. The `node-fetch-event` server always exposes `CacheStorage`, `Cache`, `caches` and `caches.default`.

`Cache` persists to disk as subdirectories of a the directory `__directory/Cache`. `Cache-Control` and `Expires` headers are respected. The only function currently implemented
for `CacheStorage` is `open`. `Cache` is fully implemented.

## Environment Variables and Data Stores

In some cases, e.g. `Cloudflare`, your hosting provider will automatically add variables to your serverless function. If not, you will also need to conditionally add them.

The `node-fetch-event` server exposes `KVStore` with the same API as [Cloudflare][https://developers.cloudflare.com/workers/runtime-apis/kv]. However, in the BETA the
storage is just local to the server and the `limit` and `cursor` options to `list` are ignored.

```
var MYSECRET;
if(typeof(requireFromUrl)!=="undefined") {
	MYSECRET = "don't tell";
}

async function handleRequest(request) {
	return new Response("hello world");
}

addEventListener("fetch",(event) => {
	const response = event.response;
	if(response) {
		response.headers.set("content-type","text/html");
		response.end(MYSECRET);
		return response;
	}
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

These DO NOT immediately stream to the client, they just sit on a stream inside the Response. Internally, the Response creates a readable stream on 
a buffer into which data is pushed by `write` and `end`. This can be conveniently processed by the standard body reading methods.

Note: Use `new Response()` or `new Response(undefined,options)` not `new Response(null)` to get this behavior.

You can also create Responses with writable streams. When returned by `respondWith`, the stream is considered complete and the buffer underlying 
the stream is written to the client. Continued attempts to write to the buffer will result in illdefined behavior.

## Internals

Internally, the `node-fetch-event` server isolates the execution of requested routes to Node `worker_threads` and runs it's http(s) request handler 
using Node `cluster`.

## Acknowledgements

In addition to the dependencies in `package.json`, portions of this library use source code from the stellar [node-fetch](https://www.npmjs.com/package/node-fetch).

## Release History (reverse chronological order)

2020-08-31 v0.0.7a Added unit tests and fixed numerous issues as a result. 
	Add CacheStorage. Eliminated setting backing store for `Cache` (for now).
	Added WriteableStream support to Response.
	Removed stanalone option. Clustering is automatic if maxServers>=2, otherwise standalone
	Headers now properly returned by Workers
	Worker limits at server now properly set defaults for worker limits and can be overriden by routes
	Anticipate this is the final ALPHA

2020-08-27 v0.0.6a Added additional missing imports for each worker, e.g. atob, TextEncoder, crypto, etc.

2020-08-27 v0.0.5a Added KVStore. Improved documentation.

2020-08-26 v0.0.4a Improved routing

2020-08-26 v0.0.3a Simplified stylized coding. Made workers into threads. Added regular expression routes. Removed streaming.

2020-08-24 v0.0.2a Added route and cache support

2020-08-24 v0.0.1a First public release