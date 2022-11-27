const { ChartJSNodeCanvas } = require(`chartjs-node-canvas`);
const mysql = require(`mysql`);
const fs = require(`fs`);

const config = require(`../config.json`);
const query = require(`./database/query.js`);

// Initialising mysql database
let con = mysql.createConnection({
	host: `localhost`,
	user: config.databaseUsername,
	password: config.databasePassword,
	database: config.databaseName
});

con.connect();

async function create() {
	const width = 1000;
	const height = 500;
	const backgroundColor = `white`;
	const chart = new ChartJSNodeCanvas({ width, height, backgroundColor });

	let stats = await query(con, `SELECT * FROM stats;`);

	let labels = [], data = [];
	for (var i = 0; i < stats.length; i++) {
		let s = stats[i];
		labels.push(s.Date.split(`d`).join(``));
		data.push(s.Total);
	}

	const configuration = {
		type: `line`,
		data: {
			labels: labels,
			datasets: [{
				label: `Total stats`,
				data: data,
				fill: false,
				borderColor: `rgb(75, 192, 192)`,
				tension: 0.1
			}]
		}
	};

	const image = await chart.renderToBuffer(configuration, `image/png`);

	fs.writeFileSync(`image.png`, image, err => { if (err) throw err; });

	console.log(image);
}

create();