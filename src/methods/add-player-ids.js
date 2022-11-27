let all = require(`../assets/players/nba/details.json`).players;
let fs = require(`fs`);

let names = {};
let ids = {};

for (var i = 0; i < all.length; i++) {
    names[all[i].id] = all[i].full_name;
    ids[all[i].full_name.toLowerCase()] = all[i].id;
}

fs.writeFileSync(`../assets/players/nba/names2.json`, JSON.stringify(names), err => { if (err) throw err; });
fs.writeFileSync(`../assets/players/nba/ids2.json`, JSON.stringify(ids), err => { if (err) throw err; });