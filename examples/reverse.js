function reverse(data) {
	if(data.reverse) {
		return data.reverse();
	}
	if(typeof(data)==="string") {
		return reverse(data.split("")).join("");
	}
	const reversed = [];
	for(const value of data) {
		reversed.unshift(data)
	}
	return reversed;
}

export { reverse as default, reverse};
module.exports = reverse;
reverse.reverse = reverse;