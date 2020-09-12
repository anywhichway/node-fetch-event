const routes = {
	"get": {
		"/": {
			"path": "worker"
		},
		"/\/hello.*/": {
			"path": "worker"
		},
		"/\/bye.*/": {
			"path": "http://localhost:8082/goodbye.js",
			"maxAge": 36000
		},
		"/message/:content": [
			/*(req,res,next) => { next(); },
			(req,res,next) => next({
				"path": "message?content=hello world",
				"useQuery": true
			}),
			(req,res,next) => { console.log("ok"); next(); }*/
			async (req,res) => { ; },
			async (req,res) => { 
				return {
					"path": "message.js",
					"params": {content:"hello world"},
					"useQuery": true
				}
			},
			async (req,res) => console.log("end of route for message/:content")
			],
		"/kvstore": {
			"path": "kvstore"
		}
	}
}
export { routes as default };
module.exports = routes;