// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fs = require(`fs`);
const path = require(`path`);

// Methods
const formatDate = require(`../methods/format-date.js`);
const formatTeam = require(`../methods/format-team.js`);
const getJSON = require(`../methods/get-json.js`);
const convertToPercentage = require(`../methods/convert-to-percentage.js`);

// Assets
const teamDetails = require(`../assets/teams/details.json`);
const teamTricodes = require(`../assets/teams/tricodes.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamIDs = require(`../assets/teams/ids.json`);
const teamColors = require(`../assets/teams/colors.json`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`boxscore`)
		.setDescription(`Returns a team's boxscore from today or a specified date.`)
		.addStringOption(option => option.setName(`team`).setDescription(`A team, e.g. PHX or Suns`).setRequired(true))
		.addStringOption(option => option.setName(`date`).setDescription(`Tomorrow/yesterday/tomorrow or a date in mm/dd/yyyy format.`)),
	
	async execute(variables) {
		let { interaction, con, ad } = variables;
		let interactionSource = interaction;

		let requestedTeam = interactionSource.options.getString(`team`);
		let requestedDate = interactionSource.options.getString(`date`);

		// Checking that the team and date is valid
		let today = false;
		requestedTeam = formatTeam(requestedTeam);
		if (!requestedTeam) {
			return await interactionSource.reply({ content: `Please specify a valid team, e.g. Suns or PHX. Use /teams for more info.` });
		}
		if (!requestedDate) {
			// Get today's date
			delete require.cache[require.resolve(`../cache/today.json`)];
			requestedDate = require(`../cache/today.json`).links.currentDate;
			today = true;
		} else {
			let { runDatabase } = require(`../bot.js`);
			if (runDatabase) {
				requestedDate = await formatDate(requestedDate, con, interaction.user.id);
			} else requestedDate = await formatDate(requestedDate);

			if (!requestedDate) {
				return await interactionSource.reply({ content: `Please use today/tomorrow/yesterday or a valid date in mm/dd/yyyy format, e.g. 12/25/2020.` });
			}
		}

		// Checking if cache can be used
		let json;
		if (today) {
			json = require(`../cache/${requestedDate}/scoreboard.json`);
		} else {
			if (fs.existsSync(`./cache/${requestedDate}/scoreboard.json`)) {
				json = require(`../cache/${requestedDate}/scoreboard.json`);
			} else {
				let json = await getJSON(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`);
				let dates = json.leagueSchedule.gameDates;
				for (var i = 0; i < dates.length; i++) {
					let d = new Date(dates[i].gameDate);
					d = d.toISOString().substring(0, 10).split(`-`).join(``);
					if (d == requestedDate) {
						json = dates[i];
					}
				}
			}
		}

		// Checking if the team played on that date and getting the game ID if so
		let gameID, teamLocationOriginal, otherTeamLocationOriginal, gameDetails, ogTeam, ogOpp;
		if (!json) gameID = null;
		else if (!json.games) gameID = null;

		let foundGame = false;
		function searchForGames(json) {
			gameLoop: for (var i = 0; i < json.games.length; i++) {
				if (json.games[i].awayTeam.teamTricode == requestedTeam) {
					foundGame = true;
					gameID = json.games[i].gameId;
					teamLocationOriginal = `awayTeam`;
					otherTeamLocationOriginal = `homeTeam`;
					gameDetails = json.games[i];
					ogTeam = json.games[i].awayTeam.teamTricode;
					ogOpp = json.games[i].homeTeam.teamTricode;
					break gameLoop;
				} else if (json.games[i].homeTeam.teamTricode == requestedTeam) {
					foundGame = true;
					gameID = json.games[i].gameId;
					teamLocationOriginal = `homeTeam`;
					otherTeamLocationOriginal = `awayTeam`;
					gameDetails = json.games[i];
					ogTeam = json.games[i].homeTeam.teamTricode;
					ogOpp = json.games[i].awayTeam.teamTricode;
					break gameLoop;
				}
			}
		}

		if (json.games) {
			searchForGames(json);
		}

		// Ensuring all variables are available
		if (!gameID || !teamLocationOriginal || !otherTeamLocationOriginal || !gameDetails) {
			let dateObject = new Date(requestedDate.substring(0, 4), parseInt(requestedDate.substring(4, 6)) - 1, requestedDate.substring(6, 8));
			dateLoop: for (var i = 0; i < 5; i++) {
				let yDate = new Date(dateObject.getTime() - (86400000 * (i + 1))).toISOString().substring(0, 10).split(`-`).join(``);
				if (fs.existsSync(`./cache/${yDate}/scoreboard.json`)) {
					searchForGames(require(`../cache/${yDate}/scoreboard.json`));
					if (foundGame) {
						requestedDate = yDate;
						break dateLoop;
					}
				}
			}

			if (!foundGame) return await interactionSource.reply({ content: `${requestedTeam} did not play on ${new Date(requestedDate.substring(0, 4), parseInt(requestedDate.substring(4, 6)) - 1, requestedDate.substring(6, 8)).toDateString()}.` });
		}

		if (!gameID || !teamLocationOriginal || !otherTeamLocationOriginal || !gameDetails || !foundGame) return await interactionSource.reply({ content: `${requestedTeam} did not play on ${new Date(requestedDate.substring(0, 4), parseInt(requestedDate.substring(4, 6)) - 1, requestedDate.substring(6, 8)).toDateString()}.` });
		
		// Getting date object
		if (gameDetails.gameDateTimeUTC) dateObject = new Date(new Date(gameDetails.gameDateTimeUTC) - 1000 * 3600 * 5);
		else dateObject = new Date(new Date(gameDetails.gameTimeUTC) - 1000 * 3600 * 5);

		// Checking if game is yet to start
		if (gameDetails.gameStatus == 1) {
			return await interactionSource.reply({ content: `${gameDetails[teamLocationOriginal].teamTricode} ${(teamLocationOriginal == `homeTeam`) ? `v` : `@`} ${gameDetails[otherTeamLocationOriginal].teamTricode} on ${dateObject.toDateString()} has not started yet.` });
		}

		let cachedBoxscore; 
		// Pausing for a lil bit
		/* Seeing if a completed boxscore is already cached
		if (gameDetails.statusNum == 3) {
			if (fs.existsSync(path.join(__dirname, `../cache/${requestedDate}/`))) {
				if (fs.existsSync(path.join(__dirname, `../cache/${requestedDate}/${gameDetails.teamId}_boxscore.json`))) {
					cachedBoxscore = require(`../cache/${requestedDate}/${gameDetails.teamId}_boxscore.json`);
				}
			} else {
				fs.mkdir(path.join(path.join(__dirname, `../cache/${requestedDate}/`)), err => { if (err) { console.log(`error 1`); throw err; }});
			}
		} */
		

		// Getting the boxscore JSON data
		let b;
		if (cachedBoxscore) {
			b = cachedBoxscore;
		} else b = await getJSON(`https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameID}.json`);
		if (!b) {
			return await interactionSource.reply({ content: `An error occurred fetching the boxscore.`});
		}

		// Writing boxscore to cache
		if (!cachedBoxscore && gameDetails.gameStatus == 3) {
			fs.writeFileSync(path.join(__dirname, `../cache/${requestedDate}/${gameDetails.gameId}_boxscore.json`), JSON.stringify(b), err => {
				if (err) { console.log(`error 2`); throw err; }
			});
		}

		// Stuff for buttons
		let mode = true;

		async function getBoxscore(update, interaction, setting) {
			let teamLocation = setting ? (teamLocationOriginal == `awayTeam` ? `awayTeam` : `homeTeam`) : (teamLocationOriginal == `awayTeam` ? `homeTeam` : `awayTeam`);
			let otherTeamLocation = (teamLocation == `awayTeam`) ? `homeTeam` : `awayTeam`;

			// Re-requesting boxscore
			b = await getJSON(`https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameID}.json`);
		
			let embed = new Discord.MessageEmbed()
				.setTitle(`Boxscore for ${teamEmojis[gameDetails[teamLocation].teamTricode]} ${gameDetails[teamLocation].teamTricode} ${(teamLocation == `homeTeam`) ? `v` : `@`} ${gameDetails[otherTeamLocation].teamTricode} ${teamEmojis[gameDetails[otherTeamLocation].teamTricode]}`)
				.setDescription(`**Start time**: ${dateObject.toDateString()}\n**Location**: ${b.game.arena.arenaCity}, ${b.game.arena.arenaName}\n**Attendance**: ${(!b.game.attendance) ? `Unknown` : ((parseInt(b.game.attendance) == 0) ? `Unknown` : b.game.attendance)}\n**Game ID:** ${gameID}`)
				.setColor(teamColors[gameDetails[teamLocation].teamTricode]);

			let dnp = [];
			for (var i = 0; i < b.game[teamLocation].players.length; i++) {
				let a = b.game[teamLocation].players[i]
				let p = a.statistics;

				// Reasoned DNP
				if (a.notPlayingDescription) {
					dnp.push(`**${a.name}**: ${a.notPlayingDescription}`);
					continue;
				}

				// Unreasoned DNP
				if (p.minutes == `PT00M00.00S`) {
					dnp.push(`**${a.name}**: Coach's Decision`)
					continue;
				}
				if (!p.minutes) {
					dnp.push(`**${a.name}**: Coach's Decision`)
					continue;
				}

				p.min = `${p.minutes.split(`PT`).join(``).split(`M`)[0]}:${p.minutes.split(`M`)[1].split(`.`)[0]}`;

				// Actual details
				let str1 = `__#${a.jerseyNum} **${a.name}**, ${p.min} mins played__`;
				let str2 = `\`${p.points}\`pts \`${p.assists}\`ast \`${p.reboundsTotal}\`reb \`${p.steals}\`stl \`${p.blocks}\`blk \`${p.turnovers}\`to \`${p.fieldGoalsMade}-${p.fieldGoalsAttempted} ${convertToPercentage(p.fieldGoalsMade, p.fieldGoalsAttempted)}\`fg \`${p.freeThrowsMade}-${p.freeThrowsAttempted} ${convertToPercentage(p.freeThrowsMade, p.freeThrowsAttempted)}\`ft \`${p.threePointersMade}-${p.threePointersAttempted} ${convertToPercentage(p.threePointersMade, p.threePointersAttempted)}\`3p \`${p.foulsPersonal}\`pf \`${p.plusMinusPoints}\`+/-`;

				embed.addField(str1, str2);
			}

			if (dnp.length > 0) {
				embed.addField(`**DNP**`, dnp.join(`, `));
			}

			// Getting shotchart
			let teamString = `${gameDetails[teamLocation].teamTricode} Shot Chart ${teamLocation == `homeTeam` ? `vs` : `@`} ${gameDetails[otherTeamLocation].teamTricode} on ${new Date(`${requestedDate.substring(0, 4)}-${requestedDate.substring(4, 6)}-${requestedDate.substring(6, 8)}`).toDateString()}`;
			let shotchart = await require(`../methods/get-shotchart.js`)(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameID}.json`, gameDetails[teamLocation].teamTricode, teamString);
			if (shotchart) {
				let fileName = `shotchart.png`;
                shotchart = new Discord.MessageAttachment(shotchart, fileName);
				embed.setImage(`attachment://${fileName}`);
			}

			const row = new Discord.MessageActionRow()
				.addComponents(
					new Discord.MessageButton()
						.setCustomId(`${gameDetails[otherTeamLocation].teamTricode}-${gameID}-${interactionSource.id}`)
						.setLabel(`${gameDetails[otherTeamLocation].teamTricode} boxscore`)
						.setStyle(`PRIMARY`)
						.setEmoji(teamEmojis[gameDetails[otherTeamLocation].teamTricode]),

					new Discord.MessageButton()
						.setCustomId(`${gameDetails[teamLocation].teamTricode}-${gameID}-${interactionSource.id}`)
						.setLabel(`Refresh`)
						.setStyle(`PRIMARY`),

					new Discord.MessageButton()
						.setURL(`https://www.nba.com/game/${gameDetails.awayTeam.teamTricode.toLowerCase()}-vs-${gameDetails.homeTeam.teamTricode.toLowerCase()}-${gameID}/box-score`)
						.setLabel(`NBA.com`)
						.setStyle(`LINK`),
				);

			if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

			let package = (shotchart) ? { embeds: [embed], components: [row], files: [shotchart]} : { embeds: [embed], components: [row] };

			if (update) {
				await interaction.update(package);
			} else await interaction.reply(package);
		}

		// Initial interaction reply
		getBoxscore(false, interactionSource, true);

		// Collecting responses
		const filter = i => teamNicknames[i.customId.split(`-`)[0]] && i.customId.split(`-`)[1] == gameID && i.user.id == interactionSource.user.id && interactionSource.id == i.customId.split(`-`)[2];
		const collector = interactionSource.channel.createMessageComponentCollector({ filter });
		collector.on(`collect`, async i => {
			collector.resetTimer();
			await require(`../methods/add-to-button-count.js`)(con);

			mode = (i.customId.split(`-`)[0] == requestedTeam);
			
			getBoxscore(true, i, mode);
		});
	},
};
