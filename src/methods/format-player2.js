// Assets
let ids = {
    nba: require(`../assets/players/nba/ids.json`),
    bdl: require(`../assets/players/bdl/ids.json`),
},
names = {
    nba: require(`../assets/players/nba/names.json`),
    bdl: require(`../assets/players/bdl/names.json`),
};

let seasons = [2021, 2020, 2019, 2018, 2017, 2016];

module.exports = async (input, season) => {
    let possible = {
        nba: {},
        bdl: {},
    };
    let namesAlreadyPushed = [];

    // If season specified is before 2016, force bdl
    let seasonBefore = false;
    if (season) {
        if (parseInt(season) < 2016) seasonBefore = true;
    }

    // Looking for exact matches first
    if (ids[`nba`][input.toLowerCase()] && !seasonBefore) {
        possible[`nba`][ids[`nba`][input.toLowerCase()]] = input.split(` `).length;
        return [possible, season];
    } else if (ids[`bdl`][input.toLowerCase()]) {
        possible[`bdl`][ids[`bdl`][input.toLowerCase()]] = input.split(` `).length;
        return [possible, season];
    }

    // Cycling through nba
    seasonLoop: for (var i = 0; i < seasons.length; i++) {
        let json = require(`../assets/players/nba/${season}.json`);

        playerLoop: for (var j = 0; j < json.league.standard.length; j++) {
            let player = json.league.standard[j];
            let name = [player.firstName, player.lastName].join(` `);

            if (namesAlreadyPushed.includes(name.toLowerCase())) continue playerLoop;

            for (var k = 0; k < name.split(` `).length; k++) {
                if (input.toLowerCase().split(` `).includes(name.split(` `)[k].toLowerCase())) {
                    if (possible.nba[player.personId]) possible.nba[player.personId]++;
                    else possible.nba[player.personId] = 1;

                    if (!namesAlreadyPushed.includes(name.toLowerCase())) namesAlreadyPushed.push(name.toLowerCase());
                }
            }
        }
    }

    // Cycling through bdl
    IDLoop: for (var key in ids.bdl) {
        let name = key;
        if (namesAlreadyPushed.includes(name.toLowerCase())) continue IDLoop;

        for (var i = 0; i < name.split(` `).length; i++) {
            if (input.toLowerCase().split(` `).includes(name.split(` `)[i].toLowerCase())) {
                if (possible.bdl[ids.bdl[key]]) possible.bdl[ids.bdl[key]]++;
                else possible.bdl[ids.bdl[key]] = 1;
                if (!namesAlreadyPushed.includes(name.toLowerCase())) namesAlreadyPushed.push(name.toLowerCase());
            }
        }
    }

    return [possible, season];
} 