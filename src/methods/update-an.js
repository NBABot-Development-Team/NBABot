// Libraries
const fetch = require(`node-fetch`);
const fs = require(`fs`);

// Assets
const fullNames = require(`../assets/teams/full-names.json`);

// Methods
const getJSON = require(`../methods/get-json.js`);

module.exports = {
    updatePlayerIDs: async function() {
        let IDs = {}, names = {}, playerTeams = {}, teamTricodes = {}, teamIDs = {}, roster = {};

        for (var team in fullNames) {
            let name = fullNames[team].toLowerCase().replace(/ /g, `-`);
            let json = await getJSON(`https://www.actionnetwork.com/_next/data/2rragNvwQvMuXUOIUznCA/nba/odds/${name}.json`);
            
            let players = json.pageProps.team.roster;
            teamTricodes[json.pageProps.team.id] = team;
            teamIDs[team] = json.pageProps.team.id;
            for (var i = 0; i < players.length; i++) {
                IDs[players[i].full_name.toLowerCase()] = players[i].id;
                names[players[i].id] = players[i].full_name;
                playerTeams[players[i].id] = json.pageProps.team.id;
                if (!roster[json.pageProps.team.id]) roster[json.pageProps.team.id] = [];
                if (!roster[json.pageProps.team.id].includes(players[i].id)) roster[json.pageProps.team.id].push(players[i].id);
            }
        }

        fs.writeFileSync(`./assets/players/an/ids.json`, JSON.stringify(IDs), err => { if (err) throw err; });
        fs.writeFileSync(`./assets/players/an/names.json`, JSON.stringify(names), err => { if (err) throw err; });
        fs.writeFileSync(`./assets/players/an/teams.json`, JSON.stringify(playerTeams), err => { if (err) throw err; });
        fs.writeFileSync(`./assets/teams/an/tricodes.json`, JSON.stringify(teamTricodes), err => { if (err) throw err; });
        fs.writeFileSync(`./assets/teams/an/ids.json`, JSON.stringify(teamIDs), err => { if (err) throw err; });
        fs.writeFileSync(`./assets/teams/an/roster.json`, JSON.stringify(roster), err => { if (err) throw err; });
    },

    updateProps: async function() {
        // Getting available props for games yet to start, then user is using autocomplete to find
        // e.g. /prop prop: Devin Booker OVER/UNDER 25.5 PTS (1 -> 1.29) @ WAS
        // props.json: { "archived": [], "available": [] }

        delete require.cache[require.resolve(`../cache/today.json`)];
        let currentDate = require(`../cache/today.json`).links.currentDate;

        // Getting scoreboard for that date
        let games = await getJSON(`https://api.actionnetwork.com/web/v1/scoreboard/nba?period=game&date=${currentDate}`);
        games = games.games;

        for (var i = 0; i < games.length; i++) {
            let id = games[i].id;

        }
    }
};

module.exports.updatePlayerIDs();