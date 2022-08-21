// Libraries
const fetch = require(`node-fetch`);

module.exports = async (url) => {
	return new Promise(resolve => {
		fetch(url)
			.then(res => res.json())
			.then(json => resolve(json));
	});
}
