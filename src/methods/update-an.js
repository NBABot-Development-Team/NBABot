// Libraries
const fetch = require(`node-fetch`);
const fs = require(`fs`);

// Assets
const fullNames = require(`../assets/teams/full-names.json`);
const teamTricodes = require(`../assets/teams/an/tricodes.json`);
const playerNames = require(`../assets/players/an/names.json`);
const playerTeams = require(`../assets/players/an/teams.json`);

// Methods
const getJSON = require(`../methods/get-json.js`);
const convertOdds = require(`../methods/convert-odds.js`);

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

        let propsObject = {
            available: [],
            archived: []
        };

        gameLoop: for (var i = 0; i < games.length; i++) {
            let id = games[i].id;
            let awayTeamID = games[i].away_team_id;
            let homeTeamID = games[i].home_team_id;
            let available = games[i].status == `scheduled`;

            let json = await fetch(`https://api.actionnetwork.com/web/v1/games/${id}/props`);

            if (!json.ok) {
                console.log(`Game skipped`);
                continue gameLoop;
            }

            try {
                json = await json.json();
            } catch (e) {
                console.log(e);
            }

            let props = json.player_props;

            // NAME1 NAME2 @/v ABC: OVER/UNDER 25.5 PTS (-130 / 1 -> 1.30)
            const acceptedTypes = [`23`, `24`, `25`, `26`, `27`]; // blocks assists steals rebounds points
            const typeAbbreviations = {"23": `REB`, "24": `STL`, "25": `BLK`, "26": `AST`, "27": `PTS`};
            propLoop: for (var prop in props) {
                let propTypeID = prop.split(`_`)[3];
                if (!acceptedTypes.includes(propTypeID)) continue propLoop;

                playerLoop: for (var j = 0; j < props[prop].length; j++) {
                    let player = props[prop][j]
                    let optionTypes = {};
                    optionLoop: for (var option in player.rules.options) {
                       // optionTypes[player.rules.options[option].option_type.toUpperCase()] = option;
                       optionTypes[option] = player.rules.options[option].option_type.toUpperCase();
                    }

                    if (!player.odds) continue playerLoop;
                    if (player.odds.length == 0) continue playerLoop;

                    // Getting appropriate book
                    let best = {OVER: 0, UNDER: 0};
                    let value = 0;
                    bookLoop: for (var b in player.odds) {
                        // Getting best odds for over and under
                        for (var k = 0; k < player.odds[b].length; k++) {
                            let convertedOdds = convertOdds(parseInt(player.odds[b][k].money), `d`);
                            if (convertedOdds > best[optionTypes[player.odds[b][k].option_type_id]]) {
                                best[optionTypes[player.odds[b][k].option_type_id]] = convertedOdds;
                                value = player.odds[b][k].value;
                            }
                        }
                    }

                    // Working out if player is away or home
                    let locationStr = playerTeams[player.player_id] == homeTeamID ? `v` : `@`;
                    let opponent = locationStr == `v` ? teamTricodes[awayTeamID] : teamTricodes[homeTeamID];

                    for (var type in best) {
                        let str = `${playerNames[player.player_id.toString()]} ${locationStr} ${opponent} ${type} ${value} ${typeAbbreviations[propTypeID]}: ${convertOdds(best[type], `u`)} / $1 -> $${best[type]}`;
                        propsObject[available ? `available` : `archived`].push(str);
                    }
                }
            }
        }

        fs.writeFileSync(`./cache/${currentDate}/props.json`, JSON.stringify(propsObject), err => { if (err) throw err; });
    }
};

module.exports.updateProps();