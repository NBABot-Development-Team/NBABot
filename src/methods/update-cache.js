// Libraries
const fetch = require(`node-fetch`);
const fs = require(`fs`);
const path = require(`path`);
const Discord = require(`discord.js`);
const moment = require(`moment-timezone`);

/*

updateDate - keeps a universal date for the bot which rolls over once all games are done
updateScoreboard - stores a cached scoreboard every 20 seconds to prevent too many requests
updateOdds - scrapes available odds from ESPN and writes them to cache

*/

let summerLeague = false;
const config = require(`../config.json`);

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
	async updateDate(con) {
		let json = await fetch(`https://nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com/NBA/liveData/scoreboard/todaysScoreboard_00.json`);

		json = await json.json();

		let gamesExist = true;
		if (!json) gamesExist = false;
		if (!json.scoreboard) gamesExist = false;
		if (!json.scoreboard.games) gamesExist = false;
		if (json.scoreboard.games.length == 0) gamesExist = false;

		delete require.cache[require.resolve(`../cache/today.json`)];
		let prevDate = require(`../cache/today.json`).links.currentDate;

		let changed = false;

		let trueDate = moment().tz("America/New_York").format().substring(0, 10).split(`-`).join(``), currentDate;

		if (gamesExist) {
			json = json.scoreboard;

			let gamesFinished = 0;
			for (var i = 0; i < json.games.length; i++) {
				if (json.games[i].gameStatus == 3) gamesFinished++;
			}

			let nbaDate = json.games[0].gameCode.split(`/`)[0];
			if (gamesFinished == json.games.length) { // Games all done, move ahead?
				// Adding 10 minute buffer
				let time = await query(con, `SELECT * FROM first_move WHERE Date = "${prevDate}";`);
				
				let there = true;
				if (!time) there = false;
				else if (time.length == 0) there = false;

				if (there) {
					// Already tried, seeing if this time is earlier than 10 minutes ago
					time = time[0].Time;
					if (time + 1000 * 60 * 10 < new Date().getTime()) {
						currentDate = trueDate;
						changed = true;
					}
				} else {
					await query(con, `INSERT INTO first_move VALUES ("${prevDate}", ${new Date().getTime()})`);
				}
			} else {
				currentDate = nbaDate;
				changed = true;
			}
		} else {
			changed = true;
			currentDate = trueDate;
		}

		if (changed) {
			let today = require(`../cache/today.json`);

			today.links.currentDate = currentDate;

			fs.writeFileSync(`./cache/today.json`, JSON.stringify(today), err => {
				if (err) throw err;
			});
		}
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

	async updateOddsNew() {
		// https://api.beta.tab.com.au/v1/tab-info-service/sports/Basketball/competitions/NBA?jurisdiction=NSW&numTopMarkets=5

		delete require.cache[require.resolve(`../cache/today.json`)];
		let currentDate = require(`../cache/today.json`).links.currentDate;

		let json = await fetch(`https://cdn.nba.com/static/json/liveData/odds/odds_todaysGames.json`, {
			headers: config.headers
		});

		json = await json.json();
		
		gameLoop: for (var i = 0; i < json.games.length; i++) {
			let currentDateObject = new Date(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8));

			dateLoop: for (var j = 0; j < 5; j++) {
				let newDate = new Date(currentDateObject.getTime() + 86400 * 1000 * j).toISOString().substring(0, 10).split(`-`).join(``);

				let odds;
				if (fs.existsSync(`./cache/${newDate}/odds.json`)) {
					odds = require(`../cache/${newDate}/odds.json`);
				} else {
					odds = {};
				}
				
				if (fs.existsSync(`./cache/${newDate}/scoreboard.json`)) {
					let games = require(`../cache/${newDate}/scoreboard.json`).games;
					for (var k = 0; k < games.length; k++) {
						if (games[k].gameId == json.games[i].gameId) { // Found game
							let o = json.games[i];

							marketLoop: for (var l = 0; l < o.markets.length; l++) {
								if (o.markets[l].name == `2way`) {
									let market = o.markets[l].books[0];
									if (!market?.outcomes) continue marketLoop;
									for (var m = 0; m < market.outcomes.length; m++) {
										let location = market.outcomes[m].type;
										let odd = parseFloat(market.outcomes[m].odds);

										if (odd > 2) {
											odd = parseInt(100 * (odd - 1));
										} else {
											odd = parseInt(100 / (1 - odd));
										}

										if (!odds) odds = {};
										if (!odds[`${games[k].awayTeam.teamTricode} @ ${games[k].homeTeam.teamTricode}`]) {
											odds[`${games[k].awayTeam.teamTricode} @ ${games[k].homeTeam.teamTricode}`] = {};
										}
										if (!odds[`${games[k].awayTeam.teamTricode} @ ${games[k].homeTeam.teamTricode}`][`${location}TeamOdds`]) {
											odds[`${games[k].awayTeam.teamTricode} @ ${games[k].homeTeam.teamTricode}`][`${location}TeamOdds`] = {};
										}
										odds[`${games[k].awayTeam.teamTricode} @ ${games[k].homeTeam.teamTricode}`][`${location}TeamOdds`].moneyLine = odd;
									}
								}
							}

							fs.writeFileSync(`./cache/${newDate}/odds.json`, JSON.stringify(odds), err => {
								if (err) throw err;
							});

							break dateLoop;
						}
					}
				} else continue dateLoop;
			} // dateLoop
		} // gameLoop
	},

	async updateScores() {
		// Getting currentDate
		delete require.cache[require.resolve(`../cache/today.json`)];
		let currentDate = require(`../cache/today.json`).links.currentDate;

		let json = await fetch(`http://nba.cloud/league/00/2022-23/scheduleleaguev2?Format=json`);

		json = await json.json();

		let dates = json.leagueSchedule.gameDates, datePosition;
		for (var i = 0; i < dates.length; i++) {
			let d = new Date(dates[i].gameDate).toISOString().substring(0, 10).split(`-`).join(``);
			if (d == currentDate) {
				datePosition = i;
				json = dates[i];
				break;
			}
		}

		if (!json.games) {
			json = {games: []};
		} else { //https://nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com/NBA/liveData/scoreboard/todaysScoreboard_00.json
			let json2 = await getJSON(`https://nba-prod-us-east-1-mediaops-stats.s3.amazonaws.com/NBA/liveData/scoreboard/todaysScoreboard_00.json`);
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
				
				// If using todaysScoreboard_00, then can use scheduleLeagueV2_1 to update scores for day before
				if (dates[datePosition - 1]) {
					let yesterdayJSON = dates[datePosition - 1];
					let yesterdayDate = new Date(yesterdayJSON.gameDate).toISOString().substring(0, 10).split(`-`).join(``);
					fs.writeFileSync(`./cache/${yesterdayDate}/scoreboard.json`, JSON.stringify(yesterdayJSON), err => { if (err) throw err; });
				}
			}
		}

		// Writing to cache
		if (!fs.existsSync(`./cache/${currentDate}/`)) fs.mkdir(`./cache/${currentDate}/`, err => { if (err) throw err; });
		fs.writeFile(`./cache/${currentDate}/scoreboard.json`, JSON.stringify(json), async err => {
			if (err) throw err;
			// log?

			delete require.cache[require.resolve(`../cache/${currentDate}/scoreboard.json`)];
			let before;
			try {
				before = require(`../cache/${currentDate}/scoreboard.json`);
			} catch (e) {
				// ...
			}

			let allowedToCycle = true;
			if (!json.games) allowedToCycle = false;
			else if (json.games.length == 0) allowedToCycle = false;

			if (allowedToCycle && before) {
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

		let json = await getJSON(`http://nba.cloud/league/00/2022-23/scheduleleaguev2?Format=json`);
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
	},

	async updateAllPlayers() {
		delete require.cache[require.resolve(`../cache/today.json`)];
		let season = require(`../cache/today.json`).seasonScheduleYear;

		let json = await fetch(`https://stats.nba.com/stats/commonallplayers?IsOnlyCurrentSeason=0&LeagueID=00&Season=${season}-${(parseInt(season) + 1).toString().substring(2, 4)}`, {
			headers: config.headers
		});

		if (!json.ok) {
			console.log(`json.ok FALSE`);
			return;
		}

		json = await json.json();
		if (!json) {
			console.log(`json FALSE`);
			return;
		}

		// Getting location of headers
		let headers = {};
		for (var i = 0; i < json.resultSets[0].headers.length; i++) {
			headers[json.resultSets[0].headers[i]] = i;
		}

		// Assigning the player info
		let players = json.resultSets[0].rowSet;
		let ids = {}, names = {}, details = {};
		for (var i = 0; i < players.length; i++) {
			ids[players[i][headers[`DISPLAY_FIRST_LAST`]].toLowerCase()] = players[i][headers[`PERSON_ID`]];
			names[players[i][headers[`PERSON_ID`]]] = players[i][headers[`DISPLAY_FIRST_LAST`]];
			details[players[i][headers[`PERSON_ID`]]] = {
				name: players[i][headers[`DISPLAY_FIRST_LAST`]],
				from: players[i][headers[`FROM_YEAR`]],
				to: players[i][headers[`TO_YEAR`]],
				team: players[i][headers[`TEAM_ABBREVIATION`]]
			};
		}

		fs.writeFileSync(`./assets/players/all/names.json`, JSON.stringify(names), err => { if (err) throw err; });
		fs.writeFileSync(`./assets/players/all/ids.json`, JSON.stringify(ids), err => { if (err) throw err; });
		fs.writeFileSync(`./assets/players/all/details.json`, JSON.stringify(details), err => { if (err) throw err; });
	}
}
