// Libraries
const fetch = require(`node-fetch`);

// Assets
let ids = {
    nba: require(`../assets/players/nba/ids.json`),
    bdl: require(`../assets/players/bdl/ids.json`),
},
names = {
    nba: require(`../assets/players/nba/names.json`),
    bdl: require(`../assets/players/bdl/names.json`),
};

let seasons = [2016, 2017, 2018, 2019, 2020, 2021];

module.exports = async (input, season) => {
    let possible = {
        nba: {},
        bdl: {},
    };
    let namesAlreadyPushed = [];

    let seasonBefore = false;
    if (season) {
        if (parseInt(season) < 2016) {
            seasonBefore = true;
        }
    }

    // Seeing if it perfectly matches, first nba then bdl
    if (ids[`nba`][input.toLowerCase()] && !seasonBefore) {
        possible[`nba`][ids[`nba`][input.toLowerCase()]] = input.split(` `).length;
        return [possible, null];
    } else if (ids[`bdl`][input.toLowerCase()]) {
        possible[`bdl`][ids[`bdl`][input.toLowerCase()]] = input.split(` `).length;
        return [possible, null];
    }

    // Seeing if there's an exact match in the NBA api
    if (season) {
        for (var i = 0; i < seasons.length; i++) {
            let json = require(`../assets/players/nba/${seasons[i]}.json`);

            for (var j = 0; j < json.league.standard.length; j++) {
                let player = json.league.standard[i];

                if (`${player.firstName} ${player.lastName}`.toLowerCase() == input.toLowerCase()) {
                    return [{ nba: [player.playerId], bdl: [] }, seasons[i]];
                }
            }
        }
    }

    // Looking for possibilities
    sourceLoop: for (var key in possible) {
        if (seasonBefore && key == `nba`) continue;
        nameLoop: for (var name in ids[key]) {
            if (namesAlreadyPushed.includes(name)) continue nameLoop;
            let names = name.split(` `);
            namesLoop: for (var i = 0; i < names.length; i++) {
                let requests = input.toLowerCase().split(` `);
                if (requests.includes(names[i].toLowerCase())) {
                    possible[key].push(ids[key][name].toString());
                    namesAlreadyPushed.push(name);
                }
            }
        }
    }

    return [possible, null];
};