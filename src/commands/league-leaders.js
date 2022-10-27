// https://stats.nba.com/stats/leagueleaders?ActiveFlag=&LeagueID=00&PerMode=Totals&Scope=S&Season=2022-23&SeasonType=Regular+Season&StatCategory=PTS

// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);

// Methods
const formatSeason = require(`../methods/format-season.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`league-leaders`)
		.setDescription(`Get the current or past leaders of a specific statistic.`)
        .addStringOption(option => option.setName(`stat`).setDescription(`Which statistic you want to find league leaders for.`).addChoices({
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
            name: `Field Goal Percentage`,
            value: `FG_PCT`
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
            name: `Three Point Percentage`,
            value: `FG3_PCT`
        }).addChoices({
            name: `Free Throws Made`,
            value: `FTM`
        }).addChoices({
            name: `Free Throws Attempted`,
            value: `FTA`
        }).addChoices({
            name: `Free Throw Percentage`,
            value: `FT_PCT`
        }).setRequired(true))
        .addStringOption(option => option.setName(`mode`).setDescription(`Whether you want to find per-game or total leaders.`).addChoices({
            name: `Per Game`,
            value: `PerGame`
        }).addChoices({
            name: `Totals`,
            value: `Totals`
        }))
        .addStringOption(option => option.setName(`season`).setDescription(`A season, e.g. 2018-2019, 2018-19, or 2018.`))
        .addStringOption(option => option.setName(`season-type`).setDescription(`Whether you want leaders from the regular season or playoffs.`).addChoices({
            name: `Regular Season`,
            value: `Regular+Season`
        }).addChoices({
            name: `Playoffs`,
            value: `Playoffs`
        })),
    
	async execute(variables) {
		let { interaction, ad } = variables;

        let stat = interaction.options.getString(`stat`);
        let mode = interaction.options.getString(`mode`);
        let season = interaction.options.getString(`season`);
        let seasonType = interaction.options.getString(`season-type`);

        if (!mode) mode = `PerGame`;
        if (!season) {
            delete require.cache[require.resolve(`../cache/today.json`)];
            let today = require(`../cache/today.json`);
            season = today.seasonScheduleYear;
        } else {
            season = formatSeason(season);
            if (!season) return await interaction.reply(`Please use a valid season, e.g. 2018-2019, 2018-19, or 2018.`);
        }
        if (!seasonType) seasonType = `Regular+Season`;

        if ([`FG_PCT`, `FT_PCT`, `FG3_PCT`].includes(stat)) mode = `Totals`;

        await interaction.deferReply();
        
        fetch(`https://stats.nba.com/stats/leagueleaders?ActiveFlag=&LeagueID=00&PerMode=${mode}&Scope=S&Season=${season}-${(parseInt(season) + 1).toString().substring(2, 4)}&SeasonType=${seasonType}&StatCategory=${stat}`, {
            headers: require(`../config.json`).headers
        }).then(async res => {
            let json = await res.text();
            json = JSON.parse(json);

            let embed = new Discord.MessageEmbed()
                .setTitle(`${teamEmojis.NBA} __${season}-${parseInt(season) + 1} ${seasonType.split(`+`).join(` `)} ${(mode == `PerGame`) ? `Per Game` : `Total`} League Leaders for ${stat}:__`)
                .setColor(teamColors.NBA);

            let leaders = json.resultSet.rowSet;
            let max = 20;
            let description = ``;

            // Locating where stat is
            let statPosition;
            for (var i = 0; i < json.resultSet.headers.length; i++) {
                if (json.resultSet.headers[i] == stat.toUpperCase()) {
                    statPosition = i;
                }
            }
            if (!statPosition) return await interaction.editReply(`An error occurred finding that stat.`);

            for (var i = 0; i < max; i++) {
                if ([`FG_PCT`, `FT_PCT`, `FG3_PCT`].includes(stat)) leaders[i][statPosition] = (parseFloat(leaders[i][statPosition]) * 100).toFixed(1);
                description += `${i + 1}) \`${leaders[i][statPosition]}\` - **${leaders[i][2]}** ${teamEmojis[leaders[i][3]]}\n`
            }

            embed.setDescription(description);

            if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

            return await interaction.editReply({ embeds: [embed] });
        });
	},
};
