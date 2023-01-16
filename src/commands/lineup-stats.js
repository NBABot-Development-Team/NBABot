// Libraries
const { SlashCommandBuilder } = require(`@discordjs/builders`);
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);

// Assets
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamColors = require(`../assets/teams/colors.json`);
const teamIDs = require(`../assets/teams/ids.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);

// Methods
const formatTeam = require(`../methods/format-team.js`);
const formatSeason = require(`../methods/format-season.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`lineup-stats`)
		.setDescription(`Get the basic stats for a team's top lineup combinations.`)
        .addStringOption(option => option.setName(`team`).setDescription(`An NBA team, e.g. LAL or Lakers.`))
        .addStringOption(option => option.setName(`season`).setDescription(`An NBA season, e.g. 2019-2020, 2019-20, or 2019.`))
        .addStringOption(option => option.setName(`sort_by`).setDescription(`Sort by the best/worst of offensive/defensive/net rating.`).addChoices({
            name: `Offensive rating, best → worst`,
            value: `off_best`
        }).addChoices({
            name: `Offensive rating, worst → best`,
            value: `off_worst`,
        }).addChoices({
            name: `Defensive rating, best → worst`,
            value: `def_best`
        }).addChoices({
            name: `Defensive rating, worst → best`,
            value: `def_worst`
        }).addChoices({
            name: `Net rating, best → worst`,
            value: `net_best`
        }).addChoices({
            name: `Net rating, worst → best`,
            value: `net_worst`
        }).addChoices({
            name: `Minutes, highest → lowest`,
            value: `minutes`
        }))
        .addNumberOption(option => option.setName(`minimum_minutes`).setDescription(`An optional minimum minutes played total for a lineup to appear.`)),
    
	async execute(variables) {
		let { interaction, ad, con } = variables;

        await interaction.deferReply();

        // Validating inputs
		let requestedTeam = interaction.options.getString(`team`), team;
        if (requestedTeam) {
            team = formatTeam(requestedTeam);
            if (!team) return await interaction.editReply(`\`${requestedTeam}\` is not a valid NBA team. Check \`/teams\` for a list of valid NBA teams.`);
        }

        let requestedSeason = interaction.options.getString(`season`), season;
        if (requestedSeason) {
            season = formatSeason(requestedSeason);
            if (!season) return await interaction.editReply(`\`\` is not a valid NBA season. Please format it as \`2019-2020\`, \`2019-20\`, \`2019\`, or just leave blank for this current season.`);
        } else {
            delete require.cache[require.resolve(`../cache/today.json`)];
            season = require(`../cache/today.json`).seasonScheduleYear;
        }

        let sortBy = interaction.options.getString(`sort_by`) || `minutes`;
        let minimum = interaction.options.getNumber(`minimum_minutes`);
        if (!minimum) minimum = 0;

        const url = `https://stats.nba.com/stats/leaguedashlineups?Conference=&DateFrom=&DateTo=&Division=&GameSegment=&GroupQuantity=5&LastNGames=0&LeagueID=&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=&PaceAdjust=N&PerMode=Totals&Period=0&PlusMinus=N&Rank=N&Season=${season}-${(parseInt(season) + 1).toString().substring(2, 4)}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&TeamID=${team ? teamIDs[team] : ``}&VsConference=&VsDivision=`;

        let json = await fetch(url, {
            headers: require(`../config.json`).headers
        });

        if (!json.ok) return await interaction.editReply(`An error occurred fetching that information.`);
        json = await json.json();
        if (!json) return await interaction.editReply(`An error occurred fetching that information.`);

        let headerPositions = {}, headers = json.resultSets[0].headers;
        for (var i = 0; i < headers.length; i++) {
            headerPositions[headers[i]] = i;
        }

        let lineups = json.resultSets[0].rowSet;

        let biggerBetter = {
            OFF_RATING: true,
            DEF_RATING: false,
            NET_RATING: true
        };

        async function getLineupStats(currentInteraction, update, start, page) {
            let description = ``;

            // Sorting lineups by chosen stat if defined
            if (sortBy && sortBy != `minutes`) {
                sortBy = sortBy.split(`_`);
                let pos = headerPositions[`${sortBy[0].toUpperCase()}_RATING`];
                lineups.sort((a, b) => {
                    if (sortBy[1] == `worst`) {
                        return biggerBetter[`${sortBy[0].toUpperCase()}_RATING`] ? (a[pos] - b[pos]) : (b[pos] - a[pos]);
                    } else {
                        return biggerBetter[`${sortBy[0].toUpperCase()}_RATING`] ? (b[pos] - a[pos]) : (a[pos] - b[pos]);
                    }
                });
                description += `Sorted by \`${sortBy[0].toUpperCase()}RTG\`, ${(sortBy[1] == `best`) ? `best → worst` : `worst → best`}\n`;
                sortBy = sortBy.join(`_`);
            }

            if (minimum) {
                lineups = lineups.filter(a => parseInt(a[headerPositions[`MIN`]]) >= minimum);
                description += `Minimum minutes: \`${minimum}\``;
            }
            
            let teamStr = (team) ? ` for the ${teamEmojis[team]} ${teamNicknames[team]}` : ``;

            let embed = new Discord.MessageEmbed()
                .setTitle(`__Lineup Statistics${teamStr}:__`)
                .setColor(team ? teamColors[team] : teamColors.NBA);

            let counter = 0;
            for (var i = start; i < lineups.length; i++) {
                let str1 = `${i + 1}) **${lineups[i][headerPositions[`GROUP_NAME`]]}**`;
                let str2 = `${!team ? `${teamEmojis[lineups[i][headerPositions[`TEAM_ABBREVIATION`]]]} ` : ``}MIN: \`${lineups[i][headerPositions[`MIN`]]}\`, OFFRTG: \`${lineups[i][headerPositions[`OFF_RATING`]]}\`, DEFRTG: \`${lineups[i][headerPositions[`DEF_RATING`]]}\`, NETRTG: \`${lineups[i][headerPositions[`NET_RATING`]]}\`\n`;
                
                embed.addField(str1, str2);
                counter++;
                if (counter >= 10) break;
            }
    
            if (description) embed.setDescription(description);
            if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

            // Sorting out buttons
            let row, rowAdded = false;
            if (lineups.length > 10) {
                rowAdded = true;
                row = new Discord.MessageActionRow();
                if (lineups[start - 10] && page - 1 > 0) {
                    row.addComponents(
                        new Discord.MessageButton()
                            .setCustomId(`ls-${team ? team : `nba`}-${start - 10}-${page - 1}-${minimum}-${sortBy}`)
                            .setLabel(`← Page ${page - 1}`)
                            .setStyle(`PRIMARY`)
                    );
                }
                row.addComponents(
                    new Discord.MessageButton()
                        .setCustomId(`nothing`)
                        .setLabel(page.toString())
                        .setStyle(`PRIMARY`)
                        .setDisabled(true)
                );
                if (lineups[start + 10]) {
                    row.addComponents(
                        new Discord.MessageButton()
                            .setCustomId(`ls-${team ? team : `nba`}-${start + 10}-${page + 1}-${minimum}-${sortBy}`)
                            .setLabel(`Page ${page + 1} →`)
                            .setStyle(`PRIMARY`)
                    );
                }
            }

            let package = rowAdded ? { embeds: [embed], components: [row] } : { embeds: [embed] };

            if (update) {
                await currentInteraction.update(package);
            } else await currentInteraction.editReply(package);
        }

        // Intial call
        getLineupStats(interaction, false, 0, 1);

        // Collecting responses
        const filter = i => i.customId.split(`-`)[0] == `ls` && i.user.id == interaction.user.id && i.customId.split(`-`)[1] == (team ? team : `nba`) && parseInt(i.customId.split(`-`)[4]) == minimum && i.customId.split(`-`)[5] == sortBy;
        const collector = interaction.channel.createMessageComponentCollector({ filter });
        collector.on(`collect`, async i => {
            collector.resetTimer();
            await require(`../methods/add-to-button-count.js`)(con);
            getLineupStats(i, true, parseInt(i.customId.split(`-`)[2]), parseInt(i.customId.split(`-`)[3]));
        });
	},
};
