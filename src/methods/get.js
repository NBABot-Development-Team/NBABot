// Libraries
const fetch = require(`node-fetch`);

module.exports = async (url) => {
	return new Promise(async resolve => {
        let res = await fetch(url);
        resolve(res);   
	});
}
