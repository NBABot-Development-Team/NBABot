// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamIDs = require(`../assets/teams/ids.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);
const teamNames = require(`../assets/teams/names.json`);
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);

// Methods
const formatTeam = require(`../methods/format-team.js`);
const getJSON = require(`../methods/get-json.js`);
const formatNumber = require(`../methods/format-number.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`schedule`)
		.setDescription(`Get a team's upcoming/previous schedule on a monthly basis.`)
        .addStringOption(option => option.setName(`team`).setDescription(`A team, e.g. PHX or Lakers.`).setRequired(true)),

	async execute(variables) {
		let { interaction, ad } = variables;

        let team = interaction.options.getString(`team`);
        team = formatTeam(team);
        if (!team) return await interaction.reply(`Please specify a valid NBA team, e.g. \`PHX\` or \`Lakers\`. Use \`/teams\` for a full list.`);
        if (!teamIDs[team]) return await interaction.reply(`Please specify a valid NBA team, e.g. \`PHX\` or \`Lakers\`. Use \`/teams\` for a full list.`);
        let teamID = teamIDs[team];

        let timestamp = new Date().getTime();

        // Getting today.json
        delete require.cache[require.resolve(`../cache/today.json`)];
        let today = require(`../cache/today.json`);
        
        // let json = await getJSON(`http://data.nba.net/10s/prod/v1/${today.seasonScheduleYear}/teams/${teamID}/schedule.json`);
        let json = await getJSON(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`);
        json = json.leagueSchedule.gameDates;
        let newJson = {league: {standard: []}};
        dateLoop: for (var i = 0; i < json.length; i++) {
            gameLoop: for (var j = 0; j < json[i].games.length; j++) {
                if ([json[i].games[j].awayTeam.teamTricode, json[i].games[j].homeTeam.teamTricode].includes(team)) {
                    json[i].games[j].currentDate = json[i].gameDate;
                    newJson.league.standard.push(json[i].games[j]);
                    break gameLoop;
                }
            }
        }
        json = newJson;

        let nextGamePosition;
        gameLoop: for (var i = json.league.standard.length - 1; i > 0; i--) {
            if (json.league.standard[i].gameStatus != 1) {
                nextGamePosition = i + 1;
                break gameLoop;
            }
        }

        if (!nextGamePosition) return await interaction.reply(`\`${team}\` has no more games to play for this season.`);

        // Sorting out which month the next game is in
        let nextGame = json.league.standard[nextGamePosition];
        if (!nextGame) return await interaction.reply(`\`${team}\` has no more games to play for this season.`);
        let months = [`January`, `February`, `March`, `April`, `May`, `June`, `July`, `August`, `September`, `October`, `November`, `December`];
        let nextGameDate = new Date(nextGame.gameDateTimeUTC);
        let currentMonth = nextGameDate.getMonth();
        let currentYear = nextGameDate.getFullYear();

        async function getSchedule(update, currentInteraction, selectedMonth) {

            let description = ``;
            for (var i = 0; i < json.league.standard.length; i++) {
                let game = json.league.standard[i];
                let currentDate = new Date(json.league.standard[i].currentDate);
                if (selectedMonth == currentDate.getMonth()) {
                    description += `${formatNumber(currentDate.getDate())}: `;
                    description += (team == game.homeTeam.teamTricode) ? `\`v ${teamNames[game.awayTeam.teamId]}\` ${teamEmojis[teamNames[game.awayTeam.teamId]]}` : `\`@ ${teamNames[game.homeTeam.teamId]}\` ${teamEmojis[teamNames[game.homeTeam.teamId]]}`;
                    description += ` : `;

                    switch (game.gameStatus) {
                        case 1:
                            description += (game.gameDateTimeUTC) ? `${new Date(game.gameDateTimeEst).toTimeString().substring(0, 5)} ET` : `TBD`;
                            break;

                        case 2:
                            description += `${team} ${(team == game.homeTeam.teamTricode) ? `${game.homeTeam.score} - ${game.awayTeam.score}` : `${game.awayTeam.score} - ${game.homeTeam.score}`} LIVE`;
                            break;

                        case 3:
                            description += `${team} ${(team == game.homeTeam.teamTricode) ? `${game.homeTeam.score} - ${game.awayTeam.score}` : `${game.awayTeam.score} - ${game.homeTeam.score}`} FINAL`;
                            break;
                    }
                    description += `\n`;
                }
            }

            if (!description) description = `No games :frowning2:`;

            // Sorting out months
            let monthBefore = (selectedMonth <= 0) ? 11 : selectedMonth - 1;
            let monthAfter = (selectedMonth >= 11) ? 0 : selectedMonth + 1;

            // Adding buttons
            const row = new Discord.MessageActionRow()
				.addComponents(
					new Discord.MessageButton()
						.setCustomId(`${team}|${monthBefore}|l|${timestamp}`) // sets customId to date which button goes to
						.setLabel(months[monthBefore])
						.setStyle(`PRIMARY`),

					new Discord.MessageButton()
						.setURL(`https://www.nba.com/schedule/${teamNicknames[team].toLowerCase()}${(currentMonth != currentMonth) ? `?cal=${months[currentMonth].toLowerCase()}` : ``}`)
						.setLabel(`NBA.com`) // link to the month's schedule on NBA.com
						.setStyle(`LINK`),

					new Discord.MessageButton()
						.setCustomId(`${team}|${monthAfter}|r|${timestamp}`)
						.setLabel(months[monthAfter])
						.setStyle(`PRIMARY`),
				);

            let embed = new Discord.MessageEmbed()
                .setTitle(`${months[selectedMonth]} ${currentYear} Schedule for ${team}:`)
                .setColor(teamColors[team])
                .setDescription(description);

            if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

            if (update) {
                await currentInteraction.update({ embeds: [embed], components: [row] });
            } else await currentInteraction.reply({ embeds: [embed], components: [row] });
        }

        // Initial schedule get
        getSchedule(false, interaction, currentMonth);

        // Collecting responses
		const filter = i => i.customId.split(`|`).length === 4 && i.user.id === interaction.user.id && i.customId.split(`|`)[3] == timestamp.toString();
		const collector = interaction.channel.createMessageComponentCollector({ filter });
		collector.on(`collect`, async i => {
			collector.resetTimer();

            // Changing years if needed
            if (parseInt(i.customId.split(`|`)[1]) == 11 && i.customId.split(`|`)[2] == `l`) {
                currentYear--;
            } else if (parseInt(i.customId.split(`|`)[1]) == 0 && i.customId.split(`|`)[2] == `r`) {
                currentYear++;
            }

			getSchedule(true, i, parseInt(i.customId.split(`|`)[1]));
		});

	},
};
