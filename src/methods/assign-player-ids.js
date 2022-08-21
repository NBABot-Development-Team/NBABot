// Libraries
const fetch = require(`node-fetch`);
const fs = require(`fs`);

// Methods
const getJSON = require(`./get-json.js`);

// seasons should be 2016 onwards

module.exports = async (seasons) => {
    let ids = {}, names = {};

    for (var i = 0; i < seasons.length; i++) {
        let json = await getJSON(`http://data.nba.net/10s/prod/v1/${seasons[i]}/players.json`);
        
        for (var j = 0; j < json.league.standard.length; j++) {
            let player = json.league.standard[j];
            if (ids[`${player.firstName.toLowerCase()} ${player.lastName.toLowerCase()}`] || names[player.personId]) continue;
            ids[`${player.firstName.toLowerCase()} ${player.lastName.toLowerCase()}`] = player.personId;
            names[player.personId] = `${player.firstName} ${player.lastName}`;
        }
    }

    fs.writeFileSync(`../assets/players/nba/ids.json`, JSON.stringify(ids), err => {
        if (err) throw err;
        else console.log(`Written to /src/assets/players/nba/ids.json.`);
    });

    fs.writeFileSync(`../assets/players/nba/names.json`, JSON.stringify(names), err => {
        if (err) throw err;
        else console.log(`Written to /src/assets/players/nba/names.json.`);
    })
}

let assign = require(`./assign-player-ids.js`);
assign([2016, 2017, 2018, 2019, 2020, 2021]);