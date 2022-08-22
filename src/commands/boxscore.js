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
		let { interaction, con } = variables;
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
		let json = await getJSON(`http://data.nba.net/10s/prod/v1/${requestedDate}/scoreboard.json`);
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
				if (json.games[i].vTeam.triCode == requestedTeam) {
					gameID = json.games[i].gameId;
					teamLocationOriginal = `vTeam`;
					otherTeamLocationOriginal = `hTeam`;
					gameDetails = json.games[i];
				} else if (json.games[i].hTeam.triCode == requestedTeam) {
					gameID = json.games[i].gameId;
					teamLocationOriginal = `hTeam`;
					otherTeamLocationOriginal = `vTeam`;
					gameDetails = json.games[i];
				}
			}
		}

		// Ensuring all variables are available
		if (!gameID || !teamLocationOriginal || !otherTeamLocationOriginal || !gameDetails) {
			return await interactionSource.reply({ content: `${requestedTeam} did not play on ${new Date(requestedDate.substring(0, 4), parseInt(requestedDate.substring(4, 6)) - 1, requestedDate.substring(6, 8)).toDateString()}.` });
		}
		
		// Getting date object
		let dateObject = new Date(gameDetails.startDateEastern.substring(0, 4), parseInt(gameDetails.startDateEastern.substring(4, 6)) - 1, gameDetails.startDateEastern.substring(6, 8));

		// Checking if game is yet to start
		if (gameDetails.statusNum == 1) {
			return await interactionSource.reply({ content: `${gameDetails[teamLocationOriginal].triCode} ${(teamLocationOriginal == `hTeam`) ? `v` : `@`} ${gameDetails[otherTeamLocationOriginal].triCode} on ${dateObject.toDateString()} has not started yet.` });
		}

		// Seeing if a completed boxscore is already cached
		let cachedBoxscore;
		if (gameDetails.statusNum == 3) {
			if (fs.existsSync(path.join(__dirname, `../cache/${requestedDate}/`))) {
				if (fs.existsSync(path.join(__dirname, `../cache/${requestedDate}/${gameDetails.teamId}_boxscore.json`))) {
					cachedBoxscore = require(`../cache/${requestedDate}/${gameDetails.teamId}_boxscore.json`);
				}
			} else {
				fs.mkdir(path.join(path.join(__dirname, `../cache/${requestedDate}/`)), err => { if (err) { console.log(`error 1`); throw err; }});
			}
		}

		// Getting the boxscore JSON data
		let b;
		if (cachedBoxscore) {
			b = cachedBoxscore;
		} else b = await getJSON(`http://data.nba.net/10s/prod/v1/${requestedDate}/${gameID}_boxscore.json`);
		if (!b) {
			return await interactionSource.reply({ content: `An error occurred fetching the boxscore.`});
		}

		// Writing boxscore to cache
		if (!cachedBoxscore && gameDetails.statusNum == 3) {
			fs.writeFileSync(path.join(__dirname, `../cache/${requestedDate}/${gameDetails.gameId}_boxscore.json`), JSON.stringify(b), err => {
				if (err) { console.log(`error 2`); throw err; }
			});
		}

		// Stuff for buttons
		let mode = true;

		async function getBoxscore(update, interaction, setting) {

			let teamLocation = setting ? (teamLocationOriginal == `vTeam` ? `vTeam` : `hTeam`) : (teamLocationOriginal == `vTeam` ? `hTeam` : `vTeam`);
			let otherTeamLocation = (teamLocation == `vTeam`) ? `hTeam` : `vTeam`;
		
			let embed = new Discord.MessageEmbed()
				.setTitle(`Boxscore for ${teamEmojis[gameDetails[teamLocation].triCode]} ${gameDetails[teamLocation].triCode} ${(teamLocation == `hTeam`) ? `v` : `@`} ${gameDetails[otherTeamLocation].triCode} ${teamEmojis[gameDetails[otherTeamLocation].triCode]}`)
				.setDescription(`**Start time**: ${dateObject.toDateString()} ${gameDetails.startTimeEastern}\n**Location**: ${gameDetails.arena.city}, ${gameDetails.arena.name}\n**Attendance**: ${(!gameDetails.attendance) ? `Unknown` : ((parseInt(gameDetails.attendance) == 0) ? `Unknown` : gameDetails.attendance)}`)
				.setColor(teamColors[gameDetails[teamLocation].triCode]);

			let dnp = [];
			for (var i = 0; i < b.stats.activePlayers.length; i++) {
				let p = b.stats.activePlayers[i];
				
				// Ensuring player is from requested team
				if (p.teamId != teamIDs[gameDetails[teamLocation].triCode]) continue;

				// Reasoned DNP
				if (p.dnp) {
					dnp.push(`**${p.firstName} ${p.lastName}**: ${p.dnp}`);
					continue;
				}

				// Unreasoned DNP
				if (p.min == `0:00`) {
					dnp.push(`**${p.firstName} ${p.lastName}**: Coach's Decision`)
					continue;
				}

				// Actual details
				let str1 = `__#${p.jersey} **${p.firstName} ${p.lastName}**, ${p.min} mins played__`;
				let str2 = `\`${p.points}\`pts \`${p.assists}\`ast \`${p.totReb}\`reb \`${p.steals}\`stl \`${p.blocks}\` \`${p.fgm}-${p.fga} ${convertToPercentage(p.fgm, p.fga)}\`fg \`${p.ftm}-${p.fta} ${convertToPercentage(p.ftm, p.fta)}\`ft \`${p.tpm}-${p.tpa} ${convertToPercentage(p.tpm, p.tpa)}\`3p \`${p.pFouls}\`pf`;

				embed.addField(str1, str2);
			}

			if (dnp.length > 0) {
				embed.addField(`**DNP**`, dnp.join(`, `));
			}

			const row = new Discord.MessageActionRow()
				.addComponents(
					new Discord.MessageButton()
						.setCustomId(gameDetails[otherTeamLocation].triCode)
						.setLabel(`${gameDetails[otherTeamLocation].triCode} boxscore`)
						.setStyle(`PRIMARY`)
						.setEmoji(teamEmojis[gameDetails[otherTeamLocation].triCode]),

					new Discord.MessageButton()
						.setURL(`https://www.nba.com/game/${gameDetails.vTeam.triCode.toLowerCase()}-vs-${gameDetails.hTeam.triCode.toLowerCase()}-${gameID}/box-score`)
						.setLabel(`NBA.com`)
						.setStyle(`LINK`),
				);

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
