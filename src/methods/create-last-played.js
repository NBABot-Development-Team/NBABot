// Libraries
const fs = require(`fs`);

let seasons = [2016, 2017, 2018, 2019, 2020, 2021];
let obj = {};

for (var i = 0; i < seasons.length; i++) {
    let json = require(`../assets/players/nba/${seasons[i]}.json`);
    for (var j = 0; j < json.league.standard.length; j++) {
        let player = json.league.standard[j];
        if (!obj[player.personId]) obj[player.personId] = seasons[i];
        else if (obj[player.personId] < seasons[i]) obj[player.personId] = seasons[i];
    }
}

fs.writeFileSync(`../assets/players/nba/last-played.json`, JSON.stringify(obj), err => {
    if (err) throw err;
    console.log(`Done, ${JSON.stringify(obj).length}`);
});