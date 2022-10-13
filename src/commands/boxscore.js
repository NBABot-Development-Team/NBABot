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
		requestedTeam = formatTeam(requestedTeam);
		if (!requestedTeam) {
			return await interactionSource.reply({ content: `Please specify a valid team, e.g. Suns or PHX. Use /teams for more info.` });
		}
		if (!requestedDate) {
			// Get today's date
			delete require.cache[require.resolve(`../cache/today.json`)];
			requestedDate = require(`../cache/today.json`).links.currentDate;
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
		let json = await getJSON(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`);
		let dates = json.leagueSchedule.gameDates;
		for (var i = 0; i < dates.length; i++) {
			let d = new Date(dates[i].gameDate);
			d = d.toISOString().substring(0, 10).split(`-`).join(``);
			if (d == requestedDate) {
				json = dates[i];
			}
		}
		/*if (fs.existsSync(`./cache/${requestedDate}/`)) {
			if (fs.existsSync(`./cache/${requestedDate}/scoreboard.json`)) {
				json = require(`../cache/${requestedDate}/scoreboard.json`);
			} else json = await getJSON(`http://data.nba.net/10s/prod/v1/${requestedDate}/scoreboard.json`);
		} else json = await getJSON(`http://data.nba.net/10s/prod/v1/${requestedDate}/scoreboard.json`); */

		// Checking if the team played on that date and getting the game ID if so
		let gameID, teamLocationOriginal, otherTeamLocationOriginal, gameDetails;
		if (!json) gameID = null;
		else if (!json.games) gameID = null;
		else {
			for (var i = 0; i < json.games.length; i++) {
				if (json.games[i].awayTeam.teamTricode == requestedTeam) {
					gameID = json.games[i].gameId;
					teamLocationOriginal = `awayTeam`;
					otherTeamLocationOriginal = `homeTeam`;
					gameDetails = json.games[i];
				} else if (json.games[i].homeTeam.teamTricode == requestedTeam) {
					gameID = json.games[i].gameId;
					teamLocationOriginal = `homeTeam`;
					otherTeamLocationOriginal = `awayTeam`;
					gameDetails = json.games[i];
				}
			}
		}

		// Ensuring all variables are available
		if (!gameID || !teamLocationOriginal || !otherTeamLocationOriginal || !gameDetails) {
			return await interactionSource.reply({ content: `${requestedTeam} did not play on ${new Date(requestedDate.substring(0, 4), parseInt(requestedDate.substring(4, 6)) - 1, requestedDate.substring(6, 8)).toDateString()}.` });
		}
		
		// Getting date object
		let dateObject = new Date(gameDetails.gameTimeUTC);

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
		
			let embed = new Discord.MessageEmbed()
				.setTitle(`Boxscore for ${teamEmojis[gameDetails[teamLocation].teamTricode]} ${gameDetails[teamLocation].teamTricode} ${(teamLocation == `homeTeam`) ? `v` : `@`} ${gameDetails[otherTeamLocation].teamTricode} ${teamEmojis[gameDetails[otherTeamLocation].teamTricode]}`)
				.setDescription(`**Start time**: ${dateObject.toDateString()}\n**Location**: ${b.game.arena.arenaCity}, ${b.game.arena.arenaName}\n**Attendance**: ${(!b.game.attendance) ? `Unknown` : ((parseInt(b.game.attendance) == 0) ? `Unknown` : b.game.attendance)}`)
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
				let str2 = `\`${p.points}\`pts \`${p.assists}\`ast \`${p.reboundsTotal}\`reb \`${p.steals}\`stl \`${p.blocks}\`blk \`${p.fieldGoalsMade}-${p.fieldGoalsAttempted} ${convertToPercentage(p.fieldGoalsMade, p.fieldGoalsAttempted)}\`fg \`${p.freeThrowsMade}-${p.freeThrowsAttempted} ${convertToPercentage(p.freeThrowsMade, p.freeThrowsAttempted)}\`ft \`${p.threePointersMade}-${p.threePointersAttempted} ${convertToPercentage(p.threePointersMade, p.threePointersAttempted)}\`3p \`${p.foulsPersonal}\`pf \`${p.plusMinusPoints}\`+/-`;

				embed.addField(str1, str2);
			}

			if (dnp.length > 0) {
				embed.addField(`**DNP**`, dnp.join(`, `));
			}

			const row = new Discord.MessageActionRow()
				.addComponents(
					new Discord.MessageButton()
						.setCustomId(gameDetails[otherTeamLocation].teamTricode)
						.setLabel(`${gameDetails[otherTeamLocation].teamTricode} boxscore`)
						.setStyle(`PRIMARY`)
						.setEmoji(teamEmojis[gameDetails[otherTeamLocation].teamTricode]),

					new Discord.MessageButton()
						.setURL(`https://www.nba.com/game/${gameDetails.awayTeam.teamTricode.toLowerCase()}-vs-${gameDetails.homeTeam.teamTricode.toLowerCase()}-${gameID}/box-score`)
						.setLabel(`NBA.com`)
						.setStyle(`LINK`),
				);

			if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

			if (update) {
				await interaction.update({ embeds: [embed], components: [row] });
			} else await interaction.reply({ embeds: [embed], components: [row ]});
		}

		// Initial interaction reply
		getBoxscore(false, interactionSource, true);

		// Collecting responses
		const filter = i => i.customId.length === 3;
		const collector = interactionSource.channel.createMessageComponentCollector({ filter });
		collector.on(`collect`, async i => {
			collector.resetTimer();
			mode = !mode;
			getBoxscore(true, i, mode);	
		});
	},
};
