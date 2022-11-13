// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);
const fs = require(`fs`);
const path = require(`path`);

// Methods
const formatDate = require(`../methods/format-date.js`);
const formatTeam = require(`../methods/format-team.js`);
const formatDuration = require(`../methods/format-duration.js`);
const getJSON = require(`../methods/get-json.js`);
const query = require(`../methods/database/query.js`);

// Assets
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);
const teamColors = require(`../assets/teams/colors.json`);
const broadcasterEmojis = require(`../assets/broadcaster-emojis.json`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`scores`)
		.setDescription(`Returns NBA scores from today or a specified date.`)
		.addStringOption(option => option.setName(`date`).setDescription(`Today/yesterday/tomorrow or a date in mm/dd/yyyy format.`))
		.addStringOption(option => option.setName(`team`).setDescription(`The specific team whose score you want to see.`)),
		
	async execute(variables) {
		let { interaction, con, ad, betting } = variables;
		let interactionSource = interaction;

		// Getting date
		let requestedDate = interactionSource.options.getString('date');

		// Getting team
		let requestedTeam = interactionSource.options.getString(`team`);
		if (requestedTeam) requestedTeam = formatTeam(requestedTeam);

		// Deleting cached info and getting current date
		delete require.cache[require.resolve(`../cache/today.json`)];
		let currentDate = require(`../cache/today.json`).links.currentDate;
		let currentDateObject = new Date(Date.UTC(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8)));
		
		let today = false;
		if (!requestedDate) { // If no date is specified, find today's date
			requestedDate = currentDate;
			today = true;
		} else {
			let { runDatabase } = require(`../bot.js`);
			if (runDatabase) {
				requestedDate = await formatDate(requestedDate, con, interaction.user.id);
			} else requestedDate = await formatDate(requestedDate);

			if (!requestedDate) return await interactionSource.reply({ content: `Please use today/tomorrow/yesterday or a date in mm/dd/yyyy format.` });
		}
		
		let dateObject = new Date(Date.UTC(requestedDate.substring(0, 4), parseInt(requestedDate.substring(4, 6)) - 1, requestedDate.substring(6, 8)));

		// update - whether the bot needs to reply or update an interactionSource
		async function getScores(update, interaction, date, removeButtons) {
			if (date.includes(`|`)) date = date.split(`|`)[0];

			// Seeing whether I can fetch from cache or a new request is needed
			let json, usedCache = false;
			if (date == require(`../cache/today.json`).links.currentDate) {
				if (fs.existsSync(`./cache/${date}/`)) {
					if (fs.existsSync(`./cache/${date}/scoreboard.json`)) {
						json = require(`../cache/${date}/scoreboard.json`);
						usedCache = true;
					}
				}
			} else {
				let currentDateObject = new Date(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8));
				let requestedDateObject = new Date(date.substring(0, 4), parseInt(date.substring(4, 6)) - 1, date.substring(6, 8));

				if (requestedDateObject.getTime() < currentDateObject.getTime()) {
					if (fs.existsSync(`./cache/${date}`)) {
						if (fs.existsSync(`./cache/${date}/scoreboard.json`)) {
							let scoreboard = require(`../cache/${date}/scoreboard.json`);

							let gamesDone = 0;
							for (var i = 0; i < scoreboard.games.length; i++) { if (scoreboard.games[i].gameStatus == 3) gamesDone++; }
							if (gamesDone == scoreboard.games.length) {
								json = scoreboard;
								usedCache = true;
							}
						}
					}
				}
			}

			if (!json) {
				if (today) {
					json = await getJSON(`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`);
					json = json.scoreboard;
				} else {
					json = await getJSON(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`);

					let dates = json.leagueSchedule.gameDates;
					for (var i = 0; i < dates.length; i++) {
						let d = new Date(dates[i].gameDate);
						d = d.toISOString().substring(0, 10).split(`-`).join(``);
						if (d == date) {
							json = dates[i];
						}
					}
				}
			}

			let newDateObject = new Date(Date.UTC(date.substring(0, 4), parseInt(date.substring(4, 6)) - 1, date.substring(6, 8)));
							
			let embed = new Discord.MessageEmbed()
				.setTitle(`${teamEmojis.NBA} __NBA Scores for ${newDateObject.toDateString()}__`)
				.setColor(teamColors.NBA);

			// Yesterday/tomorrow dates
			let yesterdayDateObject =  new Date(newDateObject.getTime() - 86400000);
			let yesterdayDate = yesterdayDateObject.toISOString().substring(0, 10).split(`-`).join(``);
			let tomorrowDateObject = new Date(newDateObject.getTime() + 86400000);
			let tomorrowDate = tomorrowDateObject.toISOString().substring(0, 10).split(`-`).join(``);
			
			// Adding buttons
			const row = new Discord.MessageActionRow()
				.addComponents(
					new Discord.MessageButton()
						.setCustomId(yesterdayDate) // sets customId to date which button goes to
						.setLabel(yesterdayDateObject.toDateString().substring(4, 10))
						.setStyle(`PRIMARY`),

					new Discord.MessageButton()
						.setURL(`https://www.nba.com/games?date=${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`)
						.setLabel(`NBA.com`) // link to that day's scoreboard on ESPN (could be something else)
						.setStyle(`LINK`),

					new Discord.MessageButton()
						.setCustomId(tomorrowDate)
						.setLabel(tomorrowDateObject.toDateString().substring(4, 10))
						.setStyle(`PRIMARY`),
				);

			// Checking if the API reponse is valid
			let numGames = 1;
			if (!json) numGames = 0;
			else if (!json.games) numGames = 0;
			else if (json.games.length == 0) numGames = 0;

			if (!numGames) {
				let noGameStr = `No games :frowning:`;
				let o = newDateObject;
				for (var i = 0; i < 10; i++) {
					let n = new Date(o.getTime() + 86400000 * (i + 1)); // Adding day in milliseconds
					if (n.getTime()	<= newDateObject.getTime()) continue; // test4
					let nDate = n.toISOString().substring(0, 10).split(`-`).join(``);
					if (fs.existsSync(`./cache/${nDate}/scoreboard.json`)) {
						let scoreboard = require(`../cache/${nDate}/scoreboard.json`);
						if (!scoreboard) continue;
						if (!scoreboard.games) continue;
						if (scoreboard.games.length == 0) continue;
						noGameStr += `\nThe next game${(scoreboard.games.length > 1) ? `s are` : ` is`} on **${n.toDateString()}**.`;
						break;
					} else continue;
				}

				embed.setDescription(noGameStr);
				if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });
				if (update) {
					return await interaction.update({ embeds: [embed]/*, components: [row]*/ });	
				} else return await interaction.reply({ embeds: [embed]/*, components: [row]*/ });
			}

			// Cycle through each game and add details to a field
			let gamesFinished = 0, allGamesFinished = false;
			let embedsAdded = 0;
			gameLoop: for (var i = 0; i < json.games.length; i++) {
				let c = json.games[i];

				if (requestedTeam) { 
					if (requestedTeam != c.awayTeam.teamTricode && requestedTeam != c.homeTeam.teamTricode) continue gameLoop; 
				}

				if (c.gameStatus == 3) gamesFinished++; 
				
				let str1 = ``;
				if (c.broadcasters && c.gameStatus < 3) {
					if (c.broadcasters.nationalTvBroadcasters) {
						if (c.broadcasters.nationalTvBroadcasters.length > 0) {
							str1 += `${broadcasterEmojis[c.broadcasters.nationalTvBroadcasters[0].broadcasterAbbreviation]}  `;
						}
					}
				}

				if (c.gameStatus == 1) {
					if (c.awayTeam.score == 0) c.awayTeam.score = ``;
					if (c.homeTeam.score == 0) c.homeTeam.score = ``;
				}

				str1 += `${(c.gameStatus == 1) ? `(${c.awayTeam.wins}-${c.awayTeam.losses})` : ``} ${teamEmojis[c.awayTeam.teamTricode]} ${(c.gameStatus == 3 && parseInt(c.awayTeam.score) > parseInt(c.homeTeam.score)) ? `__` : ``}${c.awayTeam.teamTricode} ${c.awayTeam.score}${(c.gameStatus == 3 && parseInt(c.awayTeam.score) > parseInt(c.homeTeam.score)) ? `__` : ``} @ ${(c.gameStatus == 3 && parseInt(c.homeTeam.score) > parseInt(c.awayTeam.score)) ? `__` : ``}${c.homeTeam.score} ${c.homeTeam.teamTricode}${(c.gameStatus == 3 && parseInt(c.homeTeam.score) > parseInt(c.awayTeam.score)) ? `__` : ``} ${teamEmojis[c.homeTeam.teamTricode]} ${(c.gameStatus == 1) ? `(${c.homeTeam.wins}-${c.homeTeam.losses}) ` : ``}| ${c.gameStatusText}`;
				let str2 = ``;
				if (c.playoffs) str2 += `*${c.playoffs.seriesSummaryText}*\n`;
9
				// Add countdown if game yet to start
				if (c.gameStatus == 1) { 
					if (c.gameDateTimeUTC) {
						let msUntilStart = (new Date(c.gameDateTimeUTC).getTime() - new Date().getTime());
						if (msUntilStart <= 0) {
							str2 += `Starting at any moment`;
						} else {
							str2 += `Starting ${formatDuration(new Date(c.gameDateTimeUTC).getTime())}`;
						}
					} else if (c.gameTimeUTC) {
						let msUntilStart = (new Date(c.gameTimeUTC).getTime() - new Date().getTime());
						if (msUntilStart <= 0) {
							str2 += `Starting at any moment`;
						} else {
							str2 += `Starting ${formatDuration(new Date(c.gameTimeUTC).getTime())}`;
						}
					}
				} else str2 += `...`;

				// Pause this for lil bit
				/* Game leaders if possible
				if (str2.endsWith(`...`) && c.gameStatus == 3) {
					// Checking if there is a cached boxscore to pull data from
					if (fs.existsSync(path.join(__dirname, `../cache/${date}/${c.gameId}_boxscore.json`))) {
						let cachedBoxscore = require(`../cache/${date}/${c.gameId}_boxscore.json`);
						let leaders = { points: {}, assists: {}, rebounds: {} };

						for (var stat in leaders) {
							let v = parseInt(cachedBoxscore.stats.awayTeam.leaders[stat].value), h = parseInt(cachedBoxscore.stats.homeTeam.leaders[stat].value);
							if (v > h) {
								leaders[stat] = cachedBoxscore.stats.awayTeam.leaders[stat];
							} else if (v < h) {
								leaders[stat] = cachedBoxscore.stats.homeTeam.leaders[stat];
							} else {
								// Merging two player arrays
								leaders[stat] = cachedBoxscore.stats.awayTeam.leaders[stat];
								leaders[stat].players = leaders[stat].players.concat(cachedBoxscore.stats.homeTeam.leaders[stat].players);
							}
							console.log(leaders[stat]);
							let arr = [];
							playerLoop: for (var j = 0; j < leaders[stat].players.length; j++) {
								// if (!leaders[stat].players[j].firstName || !leaders[stat].players[j].lastName) continue;
								console.log(leaders[stat].players[j]);
								if (typeof leaders[stat].players[j] == `string`) {
									leaders[stat].players[j] = leaders[stat].players[j].replace(/\s/g, ``).split(`.`).join(`. `)
									arr.push(`${leaders[stat].players[j].split(` `)[0][0]}. ${leaders[stat].players[j].split(leaders[stat].players[j].split(` `)[0]).join(``)}`);
								} else if (leaders[stat].players[j].firstName && leaders[stat].players[j].lastName) {
									arr.push(`${leaders[stat].players[j].firstName.substring(0, 1)}. ${leaders[stat].players[j].lastName}`);
								} else continue playerLoop;
							}
							leaders[stat].players = arr;
						}
						str2 = str2.substring(0, str2.length - 3);
						str2 += `**Leaders:** \`${leaders.points.value}\` pts (${leaders.points.players.join(`, `)}), \`${leaders.assists.value}\` ast (${leaders.assists.players.join(`, `)}), \`${leaders.rebounds.value}\` reb (${leaders.rebounds.players.join(`, `)})`;
					}
				} */

				if (!str2) str2 = `...`;
				if (!str1 || !str2) continue;

                if (c.gameLeaders && c.gameStatus == 3) {
                    if (c.gameLeaders.homeLeaders && c.gameLeaders.awayLeaders) {
                        if (str2 == `...`) {
                            str2 = `${c.gameLeaders.awayLeaders.name}: \`${c.gameLeaders.awayLeaders.points}\`pts \`${c.gameLeaders.awayLeaders.assists}\`ast \`${c.gameLeaders.awayLeaders.rebounds}\`reb\n${c.gameLeaders.homeLeaders.name}: \`${c.gameLeaders.homeLeaders.points}\`pts \`${c.gameLeaders.homeLeaders.assists}\`ast \`${c.gameLeaders.homeLeaders.rebounds}\`reb`;
                        } else {
                            str2 += `${c.gameLeaders.awayLeaders.name}: \`${c.gameLeaders.awayLeaders.points}\`pts \`${c.gameLeaders.awayLeaders.assists}\`ast \`${c.gameLeaders.awayLeaders.rebounds}\`reb\n${c.gameLeaders.homeLeaders.name}: \`${c.gameLeaders.homeLeaders.points}\`pts \`${c.gameLeaders.homeLeaders.assists}\`ast \`${c.gameLeaders.homeLeaders.rebounds}\`reb`;
                        }
                    }
                } else if (c.pointsLeaders && c.gameStatus == 3) {
					if (c.pointsLeaders.length > 0) {
						let str3 = ``;
						for (var j = 0; j < c.pointsLeaders.length; j++) {
							str3 += `${c.pointsLeaders[j].firstName} ${c.pointsLeaders[j].lastName}: \`${parseInt(c.pointsLeaders[j].points)}\`pts`;
						}
						if (str2 == `...`) {
							str2 = str3;
						} else {
							str2 += str3;
						}
					}
                }

				/*https://www.nba.com/watch/video/game-recap-bulls-115-raptors-98
				if (c.gameStatus == 3) {
					if (c.homeTeam.teamTricode == `POR`) teamNicknames[c.homeTeam.teamTricode] = `trail-blazers`;
					if (c.awayTeam.teamTricode == `POR`) teamNicknames[c.awayTeam.teamTricode] = `trail-blazers`;

					let info = (teamNicknames[c.awayTeam.teamTricode][0] < teamNicknames[c.homeTeam.teamTricode][0]) ? `${teamNicknames[c.awayTeam.teamTricode].toLowerCase()}-${c.awayTeam.score}-${teamNicknames[c.homeTeam.teamTricode].toLowerCase()}-${c.homeTeam.score}` : `${teamNicknames[c.homeTeam.teamTricode].toLowerCase()}-${c.homeTeam.score}-${teamNicknames[c.awayTeam.teamTricode].toLowerCase()}-${c.awayTeam.score}`;
					let highlightURL = `https://www.nba.com/watch/video/game-recap-${info}`;
					if (str2 == `...`) {
						str2 = `[Highlights](${highlightURL})`;
					} else str2 += `\n[Highlights](${highlightURL})`;
				}*/

				embed.addField(str1, str2);
				embedsAdded++;
			}
			
			if (json.games.length == gamesFinished) allGamesFinished = true;

			if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

			let { runDatabase } = require(`../bot.js`);
			if (runDatabase) {
				let user = await query(con, `SELECT * FROM users WHERE ID = "${interaction.user.id}"`);
				user = user[0];
				if (user.Betting == "y" || !betting) {
					let odds;
					if (fs.existsSync(`./cache/${date}/`)) {
						if (fs.existsSync(`./cache/${date}/odds.json`)) {
							delete require.cache[require.resolve(`../cache/${date}/odds.json`)];
							odds = require(`../cache/${date}/odds.json`);
						}
					}

					if (odds && (dateObject.getTime() > currentDateObject.getTime() || date == currentDate)) { // Odds file available
						let gamesAvailable = 0;
						for (var i = 0; i < json.games.length; i++) {
							if (odds[`${json.games[i].awayTeam.teamTricode} @ ${json.games[i].homeTeam.teamTricode}`]) {
								let game = odds[`${json.games[i].awayTeam.teamTricode} @ ${json.games[i].homeTeam.teamTricode}`];
								if (game.awayTeamOdds?.moneyLine && game.homeTeamOdds?.moneyLine) {
									gamesAvailable++;
								}
							}
						}

						if (gamesAvailable == json.games.length && !allGamesFinished) { // All available
							embed.setFooter({ text: `All of this date's simulated betting odds are available with /odds. Your balance: $${user.Balance.toFixed(2)}`});
						} else if (gamesAvailable < json.games.length) {
							embed.setFooter({ text: `${gamesAvailable}/${json.games.length} of today's simulated betting odds are available with /odds. Your balance: $${user.Balance.toFixed(2)}`});
						} else if (gamesAvailable > json.games.length) {
							embed.setFooter({ text: `All of this date's simulated betting odds are available with /odds. Your balance: $${user.Balance.toFixed(2)}`});
						} else if (!allGamesFinished) {
							embed.setFooter({ text: `Odds are not yet available for this date. Your balance: $${user.Balance.toFixed(2)}`});
						}
					} else if (dateObject.getTime() > currentDateObject.getTime() || date == currentDate) { // Odds file not available – so no odds available
						embed.setFooter({ text: `Odds are not yet available for this date. Your balance: $${user.Balance.toFixed(2)}`});
					}
				}
			}

			let sendObject = (interactionSource.user.id == `401649168948396032`) ? { embeds: [embed] } : { embeds: [embed] }; 

			if (update) {
				if (requestedDate) {
					if (embedsAdded == 0) {
						await interaction.update(`\`${requestedTeam}\` did not play on ${newDateObject.toDateString()}.`);
					} else {
						await interaction.update(sendObject);
					}
				} else await interaction.update(sendObject);
			} else {
				if (requestedDate) {
					if (embedsAdded == 0) {
						await interaction.reply(`\`${requestedTeam}\` did not play on ${newDateObject.toDateString()}.`);
					} else {
						await interaction.reply(sendObject);
					}
				} else await interaction.reply(sendObject);
			}
		}

		// Initial interaction reply
		getScores(false, interactionSource, requestedDate, false);

		// Collecting responses
		const filter = i => i.user.id === interactionSource.user.id;
		const collector = interactionSource.channel.createMessageComponentCollector({ filter });
		collector.on(`collect`, async i => {
			collector.resetTimer();
			getScores(true, i, i.customId, false);
		});
	}
}
