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
            name: `Points`,
            value: `PTS`
        }).addChoices({
            name: `Assists`,
            value: `AST`
        }).addChoices({
            name: `Steals`,
            value: `STL`
        }).addChoices({
            name: `Offensive Rebounds`,
            value: `OREB`
        }).addChoices({
            name: `Defensive Rebounds`,
            value: `DREB`
        }).addChoices({
            name: `Total Rebounds`,
            value: `REB`
        }).addChoices({
            name: `Blocks`,
            value: `BLK`
        }).addChoices({
            name: `Field Goals Made`,
            value: `FGM`
        }).addChoices({
            name: `Field Goals Attempted`,
            value: `FGA`
        }).addChoices({
            name: `Turnovers`,
            value: `TOV`
        }).addChoices({
            name: `Three Pointers Made`,
            value: `FG3M`
        }).addChoices({
            name: `Three Pointers Attempted`,
            value: `FG3A`
        }).addChoices({
            name: `Free Throws Made`,
            value: `FTM`
        }).addChoices({
            name: `Free Throws Attempted`,
            value: `FTA`
        }).addChoices({
            name: `Field Goal Percentage`,
            value: `FG_PCT`
        }).addChoices({
            name: `Free Throw Percentage`,
            value: `FT_PCT`
        }).addChoices({
            name: `Three Point Percentage`,
            value: `FG3_PCT`
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

        await interaction.deferReply();

        fetch(`https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}-${(season + 1).toString().substring(2, 4)}&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`, {
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
                if ([`FG_PCT`, `FT_PCT`, `FG3_PCT`].includes(stat)) teams[i][statPosition] = (parseFloat(teams[i][statPosition]) * 100).toFixed(1);
                description += `${i + 1}) \`${teams[i][statPosition]}\` - **${teams[i][1]} ${teamEmojis[teamNames[teams[i][0]]]}**\n`;
            }

            embed.setDescription(description);

            if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

            return await interaction.editReply({ embeds: [embed] });
        });
	},
};
