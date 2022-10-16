// Libraries
const fetch = require(`node-fetch`);
const fs = require(`fs`);
const path = require(`path`);
const Discord = require(`discord.js`);

/*

updateDate - keeps a universal date for the bot which rolls over once all games are done
updateScoreboard - stores a cached scoreboard every 20 seconds to prevent too many requests
updateOdds - scrapes available odds from ESPN and writes them to cache

*/

let summerLeague = false;

// Methods
const getJSON = require(`./get-json.js`);
const getHTML = require(`./get-html.js`);
const logger = require(`./logger.js`);
const query = require(`./database/query.js`);
const getUser = require("./database/get-user.js");
const updateUser = require("./database/update-user.js");

// Assets
const teamNicknames = require(`../assets/teams/nicknames.json`);
const teamTricodes = require(`../assets/teams/tricodes.json`);
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);

// Core variables
let counter = 0;

module.exports = {
	async updateDate() {
		fetch(`http://data.nba.net/10s/prod/v1/today.json`)
			.then(res => res.json())
			.then(today => {
				let currentDate = today.links.currentDate;

				fetch(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`)
					.then(res => res.json())
					.then(json => {
						let dates = json.leagueSchedule.gameDates;
						for (var i = 0; i < dates.length; i++) {
							let d = new Date(dates[i].gameDate).toISOString().substring(0, 10).split(`-`).join(``);
							if (d == currentDate) {
								json = dates[i];
							}
						}

						let gamesFinished = 0;
						for (var i = 0; i < json.games.length; i++) {
							if (json.games[i].gameStatus == 3) gamesFinished++;
						}

						let UTCDateObject = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), new Date().getUTCHours(), new Date().getUTCMinutes(), new Date().getUTCSeconds());
						let easternDateObject = new Date(UTCDateObject - 1000 * 60 * 60 * 4);

						// let trueDate = `${easternDateObject.getFullYear()}${(parseInt(easternDateObject.getMonth()) + 1 < 10) ? `0${easternDateObject.getMonth() + 1}` : easternDateObject.getMonth() + 1}${(parseInt(easternDateObject.getDate()) < 10) ? `0${easternDateObject.getDate()}` : easternDateObject.getDate()}`;
						let trueDate = easternDateObject.toISOString().substring(0, 10).split(`-`).join(``);
						// today.seasonScheduleYear = 2021;

						if (currentDate != trueDate) {
							if (json.games.length == gamesFinished) today.links.currentDate = trueDate;
						} else today.links.currentDate = trueDate;

						fs.writeFile(`./cache/today.json`, JSON.stringify(today), err => {
							if (err) throw err;
							// logger.cache(`Cache Updated.`);
						});
					});
			});
	},

	async updateOdds() {
		async function update() {
			counter++;
		
			// Getting currentDate
			delete require.cache[require.resolve(`../cache/today.json`)];
			let currentDate = require(`../cache/today.json`).links.currentDate;
		
			let dateObject = new Date(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8));
			let nextDate = new Date(dateObject.getTime() + (86400000 * (counter - 1)));
			nextDate = nextDate.toISOString().substring(0, 10).split(`-`).join(``);

			let json = await getJSON(`http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${nextDate}`);
			
			let object = {};
			let solutions = { "UTAH": "UTA", "GS": "GSW", "NY": "NYK", "SA": "SAS"};

			if (summerLeague) {
				let h = await getHTML(`https://www.espn.com/nba-summer-league/scoreboard/_/date/${nextDate}`);
				h = h.substring(h.search(`data: `), h.search(`</html>`));
				h = h.substring(h.search(`data: `) + `data: `.length, h.search(`\n`) - 1);
				h = h.substring(h.search(`{`), h.search(`}}}]}`) + `}}}]}`.length);
				h = JSON.parse(h);

				for (var i = 0; i < h.events.length; i++) {
					let e = h.events[i];

				}
				return; 
			}
		
			for (var i = 0; i < json.events.length; i++) {
				let event = json.events[i];
				let teams = event.shortName.split(` @ `);
		
				// Fixing incorrect team codes
				for (var j = 0; j < teams.length; j++) {
					if (solutions[teams[j]]) teams[j] = solutions[teams[j]];
				}
				event.shortName = teams.join(` @ `);
		
				let html = await getHTML(`https://www.espn.com/nba/game?gameId=${event.id}`);
				
				// Narrowing down html result
				if (html.search(`espn.gamepackage.data = `) < 0) continue;
				html = html.substring(html.search(`espn.gamepackage.data = `), html.search(`</html>`));
				html = html.substring(html.search(`espn.gamepackage.data = `) + `espn.gamepackage.data = `.length, html.search(`\n`) - 1); 
			
				// Finally adding the odd info
				object[event.shortName] = JSON.parse(html).pickcenter[0];
			}
		
			// log something?
		
			// Writing to cache
			if (!fs.existsSync(path.join(__dirname, `../cache/${nextDate}/`))) fs.mkdir(path.join(path.join(__dirname, `../cache/${nextDate}/`)), err => { if (err) { throw err; }});
			fs.writeFileSync(`./cache/${nextDate}/odds.json`, JSON.stringify(object), err => console.error(err));

			if (counter < 10) await update();
			else counter = 0;
		}

		await update();
	},

	async updateOodsTAB() {
		// https://api.beta.tab.com.au/v1/tab-info-service/sports/Basketball/competitions/NBA?jurisdiction=NSW&numTopMarkets=5

		let odds = await getJSON(`https://api.beta.tab.com.au/v1/tab-info-service/sports/Basketball/competitions/NBA?jurisdiction=NSW&numTopMarkets=5`);
	},

	async updateScores() {
		// Getting currentDate
		delete require.cache[require.resolve(`../cache/today.json`)];
		let currentDate = require(`../cache/today.json`).links.currentDate;

		let json = await getJSON(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`);
		let dates = json.leagueSchedule.gameDates;
		for (var i = 0; i < dates.length; i++) {
			let d = new Date(dates[i].gameDate).toISOString().substring(0, 10).split(`-`).join(``);
			if (d == currentDate) {
				json = dates[i];
			}
		}

		if (!json.games) {
			json = {games: []};
		} else {
			let json2 = await getJSON(`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`);
			json2 = json2.scoreboard;
			let gamesMatching = 0;
			jsonLoop: for (var i = 0; i < json.games.length; i++) {
				for (var j = 0; j < json2.games.length; j++) {
					if (json.games[i].gameId == json2.games[j].gameId) {
						gamesMatching++;
						json2.games[j].broadcasters = json.games[i].broadcasters;
						continue jsonLoop;
					}
				}
			}
			if (gamesMatching == json.games.length && gamesMatching == json2.games.length) {
				json = json2;
			}
		}
		/*
		let json = await getJSON(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`);
		let dates = json.leagueSchedule.gameDates;
		for (var i = 0; i < dates.length; i++) {
			let d = new Date(dates[i].gameDate);
			d = d.toISOString().substring(0, 10).split(`-`).join(``);
			if (d == currentDate) {
				json = dates[i];
				for (var j = 0; j < json.games.length; j++) {
					if (json.games[j].gameStatus == 3 && (json.games[j].awayTeam.score == 0 || json.games[j].homeTeam.score == 0)) {
						json = await getJSON(`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`);
						json = json.scoreboard;
					}
				}
			}
		} 
		*/

		// let json2 = await getJSON(`http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${currentDate}`);

		/* ESPN workaround
		let solutions = { "UTAH": "UTA", "GS": "GSW", "NY": "NYK", "SA": "SAS", "NO": "NOP" };
		for (var i = 0; i < json.games.length; i++) {
			// Cycling through each game and seeing if ESPN has scores instead
			if (!json.games[i].vTeam.score && !json.games[i].hTeam.score) {
				eventLoop: for (var j = 0; j < json2.events.length; j++) {
					let game = json2.events[j].competitions[0];
					let vTeam, hTeam;
					// Fixing irregularities
					for (var k = 0; k < game.competitors.length; k++) {
						if (solutions[game.competitors[k].team.abbreviation]) {
							game.competitors[k].team.abbreviation = solutions[game.competitors[k].team.abbreviation];
						}

						if (game.competitors[k].homeAway == `home`) {
							hTeam = game.competitors[k];
						} else if (game.competitors[k].homeAway == `away`) {
							vTeam = game.competitors[k];
						}
					}

					if (!vTeam || !hTeam) continue eventLoop; 

					if (vTeam.team.abbreviation == json.games[i].vTeam.triCode &&
						hTeam.team.abbreviation == json.games[i].hTeam.triCode) {
						json.games[i].vTeam.score = vTeam.score;
						json.games[i].hTeam.score = hTeam.score;
						json.games[i].period.current = game.status.period;
						json.games[i].clock = game.status.displayClock;
						if (game.status.type.name == `STATUS_FINAL`) json.games[i].statusNum = 3;
					}
				}
			} 
		} */

		// Writing to cache
		if (!fs.existsSync(`./cache/${currentDate}/`)) fs.mkdir(`./cache/${currentDate}/`, err => { if (err) throw err; });
		fs.writeFile(`./cache/${currentDate}/scoreboard.json`, JSON.stringify(json), async err => {
			if (err) throw err;
			// log?

			delete require.cache[require.resolve(`../cache/${currentDate}/scoreboard.json`)];
			let before = require(`../cache/${currentDate}/scoreboard.json`);

			let allowedToCycle = true;
			if (!json.games) allowedToCycle = false;
			else if (json.games.length == 0) allowedToCycle = false;

			if (allowedToCycle) {
				for (var i = 0; i < json.games.length; i++) {
					if (before.games[i].gameStatus == 2 && json.games[i].gameStatus == 3) {
						console.log(`Claiming bets from ${json.games[i].awayTeam.teamTriCode} @ ${json.games[i].homeTeam.teamTriCode} on ${currentDate}`);
						let claimBets = require(`./claim-bets.js`);
						await claimBets(currentDate);
					}
				}
			}
		});
	},

	async updateFutureScores() {
		// Getting currentDate
		delete require.cache[require.resolve(`../cache/today.json`)];
		let currentDate = require(`../cache/today.json`).links.currentDate;
		let currentDateObject = new Date(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8));

		let json = await getJSON(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`);
		let dates = json.leagueSchedule.gameDates;
		let counter = 0;
		for (var i = 0; i < dates.length; i++) {
			if (counter > 10) break;
			let d = new Date(dates[i].gameDate); /*.toISOString().substring(0, 10).split(`-`).join(``); */
			if (currentDateObject.getTime() >= d.getTime()) continue;
			else {
				counter++;
				d = d.toISOString().substring(0, 10).split(`-`).join(``); 
				if (!fs.existsSync(`./cache/${d}/`)) fs.mkdir(`./cache/${d}/`, err => { if (err) throw err; });
				fs.writeFile(`./cache/${d}/scoreboard.json`, JSON.stringify(dates[i]), async err => {
					if (err) throw err;
				});
			}
		}
	},

	async cleanUpBetsColumns(con) {
		let all = await query(con, `SHOW COLUMNS FROM BETS;`);

		console.log(all);
	}
}
