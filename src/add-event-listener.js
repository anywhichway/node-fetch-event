const addEventListener = (eventName,handler) => {
	addEventListener[eventName] = handler;
}
addEventListener.fetch = () => {};

export { addEventListener as default, addEventListener }
module.exports = { addEventListener }