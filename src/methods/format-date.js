// Methods
const query = require(`./database/query.js`);

module.exports = async (date, con = null, id = null) => {

	return new Promise(async resolve => {
		// JSON files
		delete require.cache[require.resolve(`../cache/today.json`)];
		let currentDate = require(`../cache/today.json`).links.currentDate;	

		// Checking for today/tomorrow
		if ([`yesterday`, `y`].includes(date.toLowerCase())) {
			let dateObject = new Date(Date.UTC(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8)));
			dateObject = new Date(dateObject.getTime() - 86400000);
			resolve(dateObject.toISOString().substring(0, 10).split(`-`).join(``));
		} else if ([`tomorrow`, `t`, `tmrw`].includes(date.toLowerCase())) {
			let dateObject = new Date(Date.UTC(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8)));
			dateObject = new Date(dateObject.getTime() + 86400000);
			resolve(dateObject.toISOString().substring(0, 10).split(`-`).join(``));
		} else if ([`today`].includes(date.toLowerCase())) {
			resolve(currentDate);
		}

		// Checking if the date is valid, and returning it in API yyyymmdd format
		if (!date.split(``).includes(`/`)) resolve();	                
		if (date.split(`/`).length != 3) resolve();
		if (!date.split(`/`)[0] || !date.split(`/`)[1] || !date.split(`/`)[2]) resolve();

		// Adding 0s e.g. 1/1/2000 -> 01/01/2000
		if (date.split(`/`)[0].length == 1) date = `0${date.split('/')[0]}/${date.split('/')[1]}/${date.split('/')[2]}`;
		if (date.split(`/`)[1].length == 1) date = `${date.split('/')[0]}/0${date.split('/')[1]}/${date.split('/')[2]}`;

		// Accounting for 22 -> 2022
		if (date.split(`/`)[2].length == 2) date = `${date.split(`/`)[0]}/${date.split(`/`)[1]}/20${date.split(`/`)[2]}`;

		// Checking if the numbers are of 2, 2, 4 length
		if (date.split(`/`)[0].length != 2 || date.split('/')[1].length != 2 || date.split(`/`)[2].length != 4) return;

		if (con && id) {
			// Checking for user date format
			let dateFormat = await query(con, `SELECT * FROM users WHERE ID = '${id}';`);
			dateFormat = dateFormat[0].DateFormat;
			console.log(`dateformat: ${dateFormat}`);
			if (dateFormat == `i`) { // Switching month and date if international
				date = `${date.split(`/`)[1]}/${date.split(`/`)[0]}/${date.split(`/`)[2]}`;
				console.log(`f-1: ${date}`);
			}
		}

		// Checking if any perameters are too big
		if (parseInt(date.split(`/`)[0]) > 12 || parseInt(date.split(`/`)[1]) > 31) return;

		// Finally returning the date in yyyymmdd format
		console.log(`f: ${date.split('/')[2]}${date.split('/')[0]}${date.split('/')[1]}`);
		resolve(`${date.split('/')[2]}${date.split('/')[0]}${date.split('/')[1]}`);
	});
};
