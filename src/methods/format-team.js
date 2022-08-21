// Assets
const teamTricodes = require(`../assets/teams/tricodes.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);

module.exports = (team) => {
	if (!team) return;
	if (teamNicknames[team.toUpperCase()]) {
		return team.toUpperCase();
	} else if (teamTricodes[team.toLowerCase()]) {
		return teamTricodes[team.toLowerCase()];
	}
};
