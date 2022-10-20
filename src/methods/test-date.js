// Libraries
const fetch = require(`node-fetch`);
const fs = require(`fs`);
const path = require(`path`);
const Discord = require(`discord.js`);
var moment = require('moment-timezone');

// Methods
const getJSON = require(`./get-json.js`);
const getHTML = require(`./get-html.js`);
const logger = require(`./logger.js`);
const query = require(`./database/query.js`);
const getUser = require("./database/get-user.js");
const updateUser = require("./database/update-user.js");

async function update() {
    let json = await getJSON(`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`);

    let gamesExist = true;
    if (!json) gamesExist = false;
    if (!json.scoreboard) gamesExist = false;
    if (!json.scoreboard.games) gamesExist = false;
    if (json.scoreboard.games.length == 0) gamesExist = false;

    let trueDate = moment().tz("America/New_York").format().substring(0, 10).split(`-`).join(``), currentDate;

    if (gamesExist) {
        json = json.scoreboard;

        let gamesFinished = 0;
        for (var i = 0; i < json.games.length; i++) {
            if (json.games[i].gameStatus == 3) gamesFinished++;
        }

        let nbaDate = json.games[0].gameCode.split(`/`)[0];
        if (gamesFinished == json.games.length) { // Games all done, move ahead?
            currentDate = trueDate;
        } else currentDate = nbaDate;
    } else currentDate = trueDate;

    let today = require(`../cache/today.json`);

    today.links.currentDate = currentDate;

    console.log(currentDate);

    fs.writeFileSync(`./cache/today.json`, JSON.stringify(today), err => {
        if (err) throw err;
    });
}

update();