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
        .addStringOption(option => option.setName(`team`).setDescription(`An NBA team, e.g. LAL or Lakers.`).setRequired(true))
        .addStringOption(option => option.setName(`season`).setDescription(`An NBA season, e.g. 2019-2020, 2019-20, or 2019.`)),
    
	async execute(variables) {
		let { interaction, ad } = variables;

        await interaction.deferReply();

        // Validating inputs
		let requestedTeam = interaction.options.getString(`team`);
        team = formatTeam(requestedTeam);
        if (!team) return await interaction.editReply(`\`${requestedTeam}\` is not a valid NBA team. Check \`/teams\` for a list of valid NBA teams.`);

        let requestedSeason = interaction.options.getString(`season`), season;
        if (requestedSeason) {
            season = formatSeason(requestedSeason);
            if (!season) return await interaction.editReply(`\`\` is not a valid NBA season. Please format it as \`2019-2020\`, \`2019-20\`, \`2019\`, or just leave blank for this current season.`);
        } else {
            delete require.cache[require.resolve(`../cache/today.json`)];
            season = require(`../cache/today.json`).seasonScheduleYear;
        }

        const url = `https://stats.nba.com/stats/leaguedashlineups?Conference=&DateFrom=&DateTo=&Division=&GameSegment=&GroupQuantity=5&LastNGames=0&LeagueID=&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=&PaceAdjust=N&PerMode=Totals&Period=0&PlusMinus=N&Rank=N&Season=${season}-${(parseInt(season) + 1).toString().substring(2, 4)}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&TeamID=${teamIDs[team]}&VsConference=&VsDivision=`;

        let json = await fetch(url, {
            headers: require(`../config.json`).headers
        });

        if (!json.ok) return await interaction.editReply(`An error occurred fetching that information.`);
        json = await json.json();
        if (!json) return await interaction.editReply(`An error occurred fetching that information.`);

        let embed = new Discord.MessageEmbed()
            .setTitle(`__Lineup Statistics for the ${teamEmojis[team]} ${teamNicknames[team]}:__`)
            .setColor(teamColors[team]);

        let headerPositions = {}, headers = json.resultSets[0].headers;
        for (var i = 0; i < headers.length; i++) {
            headerPositions[headers[i]] = i;
        }

        let lineups = json.resultSets[0].rowSet;
        for (var i = 0; i < 10; i++) {
            let str1 = `**${lineups[i][headerPositions[`GROUP_NAME`]]}**`;
            let str2 = `MIN: \`${lineups[i][headerPositions[`MIN`]]}\`, OFFRTG: \`${lineups[i][headerPositions[`OFF_RATING`]]}\`, DEFRTG: \`${lineups[i][headerPositions[`DEF_RATING`]]}\`, NETRTG: \`${lineups[i][headerPositions[`NET_RATING`]]}\``;
            embed.addField(str1, str2);
        }

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.editReply({ embeds: [embed] });
	},
};
