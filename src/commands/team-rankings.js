// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamNames = require(`../assets/teams/names.json`);

// Methods
const formatSeason = require(`../methods/format-season.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`team-rankings`)
		.setDescription(`Get the league rankings for a particular statistic.`)
        .addStringOption(option => option.setName(`stat`).setDescription(`The statistic you want to find the rankings for.`).addChoices({
            name: `Points (PTS)`,
            value: `PTS`
        }).addChoices({
            name: `Assists (AST)`,
            value: `AST`
        }).addChoices({
            name: `Offensive Rebounds (OREB)`,
            value: `OREB`
        }).addChoices({
            name: `Defensive Rebounds (DREB)`,
            value: `DREB`
        }).addChoices({
            name: `Total Rebounds (REB)`,
            value: `REB`
        }).addChoices({
            name: `Steals (STL)`,
            value: `STL`
        }).addChoices({
            name: `Blocks (BLK)`,
            value: `BLK`
        }).addChoices({
            name: `Turnovers (TOV)`,
            value: `TOV`
        }).addChoices({
            name: `Field Goals Made (FGM)`,
            value: `FGM`
        }).addChoices({
            name: `Field Goals Attempted (FGA)`,
            value: `FGA`
        }).addChoices({
            name: `Field Goal Percentage (FG%)`,
            value: `FG_PCT`
        }).addChoices({
            name: `Three Pointers Made (3PM)`,
            value: `FG3M`
        }).addChoices({
            name: `Three Pointers Attempted (3PA)`,
            value: `FG3A`
        }).addChoices({
            name: `Three Point Percentage (3P%)`,
            value: `FG3_PCT`
        }).addChoices({
            name: `Free Throws Made (FTM)`,
            value: `FTM`
        }).addChoices({
            name: `Free Throws Attempted (FTA)`,
            value: `FTA`
        }).addChoices({
            name: `Free Throw Percentage (FT%)`,
            value: `FT_PCT`
        }).addChoices({
            name: `Offensive Rating (ORTG)`,
            value: `OFF_RATING`
        }).addChoices({
            name: `Defensive Rating (DRTG)`,
            value: `DEF_RATING`
        }).addChoices({
            name: `Net Rating (NETRG)`,
            value: `NET_RATING`
        }).addChoices({
            name: `Assist/Turnover Ratio (AST/TO)`,
            value: `AST_TO`
        }).addChoices({
            name: `Effective Field Goal Percentage (EFG%)`,
            value: `EFG_PCT`
        }).addChoices({
            name: `True Shooting Percentage (TS%)`,
            value: `TS_PCT`
        }).addChoices({
            name: `Pace`,
            value: `PACE`
        }).addChoices({
            name: `Player Impact Estimate (PIE)`,
            value: `PIE`
        }).setRequired(true))
        .addStringOption(option => option.setName(`season`).setDescription(`An NBA season, e.g. 2019-2020, 2019-20, or 2019.`)),
    
	async execute(variables) {
		let { interaction, ad } = variables;

        let stat = interaction.options.getString(`stat`);
        let season = interaction.options.getString(`season`);

        if (!season) {
            delete require.cache[require.resolve(`../cache/today.json`)];
            season = require(`../cache/today.json`).seasonScheduleYear;
        } else {
            season = formatSeason(season);
            if (!season) return await interaction.reply(`Please use a valid NBA team. See \`/teams\` for more info.`);
        }

        let type = `Base`;
        let advancedStats = [`OFF_RATING`, `DEF_RATING`, `NET_RATING`, `AST_PCT`, `AST_TO`, `OREB_PCT`, `DREB_PCT`, `REB_PCT`, `TM_TOV_PCT`, `EFG_PCT`, `TS_PCT`, `PACE`, `PIE`];
        if (advancedStats.includes(stat)) type = `Advanced`;

        await interaction.deferReply();

        fetch(`https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&MeasureType=${type}&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}-${(season + 1).toString().substring(2, 4)}&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`, {
            headers: require(`../config.json`).headers
        }).then(async res => {
            let json = await res.text();
            json = JSON.parse(json);

            let headers = json?.resultSets?.[0]?.headers, rankPosition, statPosition;
            if (!headers) return await interaction.editReply(`An error occurred fetching that information.`);

            headerLoop: for (var i = 0; i < headers.length; i++) {
                if (headers[i] == `${stat}_RANK`) {
                    rankPosition = i;
                } else if (headers[i] == stat) {
                    statPosition = i;
                }
            }
            if (!rankPosition || !statPosition) return await interaction.editReply(`An error occurred locating that statistic.`);

            function compare(a, b) {
                if (a[rankPosition] < b[rankPosition]) {
                    return -1;
                }
                if (a[rankPosition] > b[rankPosition]) {
                    return 1;
                }
                return 0;
            }

            let teams = json?.resultSets?.[0]?.rowSet;
            if (!teams) return await interaction.editReply(`An error occurred fetching that information.`);

            teams.sort(compare);

            let embed = new Discord.MessageEmbed()
                .setTitle(`${teamEmojis.NBA} __${season}-${parseInt(season) + 1} Team Rankings for ${stat}:__`)
                .setColor(teamColors.NBA);

            let description = ``;

            for (var i = 0; i < teams.length; i++) {
                if ([`FG_PCT`, `FT_PCT`, `FG3_PCT`, `AST_PCT`, `OREB_PCT`, `DREB_PCT`, `REB_PCT`, `TM_TOV_PCT`, `EFG_PCT`, `TS_PCT`].includes(stat)) teams[i][statPosition] = (parseFloat(teams[i][statPosition]) * 100).toFixed(1);
                description += `\`${i < 9 ? `0` : ``}${i + 1})\` \`${teams[i][statPosition]}\` - **${teams[i][1]} ${teamEmojis[teamNames[teams[i][0]]]}**\n`;
            }

            embed.setDescription(description);

            if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

            return await interaction.editReply({ embeds: [embed] });
        });
	},
};
