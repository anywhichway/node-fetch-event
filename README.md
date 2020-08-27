# node-fetch-event

The `node-fetch-event` library is an implementation of the [FetchEvent](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent) paradigm used by several severless function providers. It is intended
to serve as an open source means of:

1) testing serverless functions in a local environment,

2) moving serverless functions to alternate hosting operations should the capabilities of the severless provider not meet the business
needs of the developer, e.g. memory or response time limits, access to additional `NodeJS` libraries, etc.

The libray includes support for [Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache), routes, data stores, and other capabilities.

The code is currently in an ALPHA state.

# Installing

`npm install node-fetch-event`

# Usage

The core functions behave, at a minimum, as one would expect:

1) addEventListener

2) event.responsdWith

3) event.waitUntil

## Writing Code

Write your worker code as you normally would, except provide substitues for trget environment variables to ensure it can continue to be deployed to serverless hosts while also running in the `node-fetch-event` environment:

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

	MYKV = // you will have to provde a substitute for the Cloudflare KV handler (we will have one soon!)

	// if your target environment supports node modules, you can require them
	// the node-fetch-event server supports all NodeJS modules
	process = require("process");
	
	// you can also get remote modules, 
	// in which case you will need to use the node-fetch-event server for hosting
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

## Running A Note Fetch Event Server

A server is provided as part of `node-fetch-event`, just start it from the command line or require it and it will start running:

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
	"maxServers": // default:1, maximum is automatically reduced to the number of cores on the computer where it is run
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

One of the key advantages of FAAS providers is their CDNs or distributed hosting. If you have the resources to establish NodeJS servers in multiple locations, 
then you can effectively have your own CDN by designating one server to be the source of your workers in the `workerSource` option. The `node-fetch-server` 
will fetch new versions based on `maxAge` data in route specifications or `cacheWorkers`. 

HINT: If you set cacheWorkers to false during development, you will not have to restarts your server when you change the worker code, just reload you browser.

### Routes

The server route specification is an object the keys of which are pathnames to match the request URL and values objects with the surface `{path,maxAge,timeout,maxIdle}`. The `maxAge` 
property is in seconds and tells the server how long it can cache the worker. The `timeout` is in miliseconds and tells the server how long it should wait for a response
prior to return an error to the client. The `maxIdle` is how long the server should let a worker be idle before stopping it. For example:

```javascript
{
	"/": {
		"path": "/worker.js"
	},
	"/hello": {
		"path": "/worker.js"
	},
	"/bye": {
		"path": "http://localhost:8082/goodbye.js", // workers can be at remote URLs, which overrides workerSource startup option
		"maxAge": 36000, // get a new copy of the worker, cacheWorkers must be set to true or a number (which this overrides)
		"timeout": 2500, // return a timeout error to client
		"maxIdle": 60000 // stop if no requests recieved for one minute
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

Query strings will be parsed and passed to the worker as an object value for special a property on the Request object, `params`. The route path can provide defaults with the originally
requested path providing the primary values, e.g.:

The routes:

```javascript
{
	"/message": {
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

### Parameterized Routes

Routes can also contain parameters, e.g.:

```javascript
{
	"/message/:content": {
		"path": "/message"
	}
}
```

## Accessing Additional Features

The `node-fetch-event` library includes support for [Cache](#cache), [Environment Variables](#environment-variables=and-data-stores), [Data Stores](#environment-variables=and-data-stores), 
[Response Pseudo Streaming](#response-pseudo-streaming).

### Cache

There is a `Cache` implementaton as part of `node-fetch-event`. The `node-fetch-event` server always exposes `Cache`, `caches` and `caches.default`.

By default `Cache` uses Map for its storage. You can replace this by setting  the startup option `cacheStorage` to any class that conforms to the 
[MAP API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) with respect to `entries()`, `delete(key)`, `get(key)`, `keys()` and `set(key,value)`. 
The `Cache` wrapper does type checking and conversion.

### Environment Variables and Data Stores

To expose environment variables, which may be bound to data stores and other things, add them to the items exposed by the `node-fetch-event` server. In some cases, e.g. `Cloudflare`, your
hosting provider will automatically add them to your serveles function. If not, you will also need to add them to the default values exposed to `main`.

``
var MYSECRET = "don't tell";

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

## Response Pseudo Streaming

If a Response is created with an `undefined` value, the `Response` objects in `node-fetch-event` have the additional methods:

1) `write`

2) `end`

These DO NOT immediately stream to the client, they just sit on a stream inside the Response. Internally, the Response creates a readable stream on a buffer into which data is pushed
by `write` and `end`. This can be conveniently processed by the standard body reading methods.

Note: Use `new Response()` or `new Response(undefined,options)` not `new Response(null)` to get this behavior. 

## Release History (reverse chronological order)

2020-08-26 v0.0.4a Improved routing

2020-08-26 v0.0.3a Simplified stylized coding. Made workers into threads. Added regular expression routes. Removed streaming.

2020-08-24 v0.0.2a Added route and cache support

2020-08-24 v0.0.1a First public release