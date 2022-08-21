// Libraries
const DiscordBotList = require(`dblapi.js`);
const mysql = require(`mysql`);
const express = require(`express`);
const http = require(`http`);
const path = require(`path`);

// Methods
const query = require(`./methods/database/query.js`);
const getUser = require(`./methods/database/get-user.js`);
const createUser = require(`./methods/database/create-user.js`);

// JSON files
const config = require(`./config.json`);

// Initialising mysql database
let con = mysql.createConnection({
	host: `localhost`,
	user: config.databaseUsername,
	password: config.databasePassword,
	database: config.databaseName
});

con.connect();

// Setting up detection server
const app = express();
const server = http.createServer();
const port = 5000;

// Sorting out dbl
const dbl = new DiscordBotList(config.dbl, {
	webhookAuth: `knicksInSix`,
	webhookServer: server,
	webhookPort: port
});

dbl.webhook.on(`ready`, hook => {
	console.log(`Hook running with http://${hook.hostname}:${hook.port}${hook.path}`);
});

dbl.webhook.on(`vote`, async vote => {
	console.log(`User with ID ${vote.user} voted!`);

	// Create user if does not exist
	let user = await getUser(con, `users`, vote.user), userExists = true;
	if (!user) userExists = false;
	else if (user.length == 0) userExists = false;
	if (!userExists) await createUser(con, `users`, vote.user);
	
	// Registering user on bets database if not already
	let bets = await getUser(con, `bets`, vote.user), betsExists = true;
	if (!bets) betsExists = false;
	else if (bets.length == 0) betsExists = false;
	if (!betsExists) await createUser(con, `bets`, vote.user);

    user = user[0];
    user.Balance += 10;

    await query(con, `UPDATE users SET Balance = ${parseFloat(user.Balance.toFixed(2))} WHERE ID = '${vote.user}';`);
});

app.get(`/`, (req, res) => {

});

server.listen(port, () => console.log(`Listening on port ${port}`));