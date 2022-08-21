const fs = require(`fs`);

let teamDetails = require(`../assets/teams/details.json`);
let teamObject = {};

for (var i = 0; i < teamDetails.league.standard.length; i++) {
	let team = teamDetails.league.standard[i];
	teamObject[team.teamId] = team.tricode;
}

fs.writeFileSync(`../assets/teams/names.json`, JSON.stringify(teamObject), err => {
	if (err) throw err;
	console.log(`Written ${JSON.stringify(teamObject).length} to ../assets/teams/names.json`);
});
