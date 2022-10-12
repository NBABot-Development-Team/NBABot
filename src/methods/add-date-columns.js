const mysql = require(`mysql`);
const config = require(`../config.json`);

let con = mysql.createConnection({
    host: `localhost`,
    user: config.databaseUsername,
    password: config.databasePassword,
    database: config.databaseName
});

con.connect();

let a = new Date();

