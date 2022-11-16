// https://stats.nba.com/stats/leagueleaders?ActiveFlag=&LeagueID=00&PerMode=Totals&Scope=S&Season=2022-23&SeasonType=Regular+Season&StatCategory=PTS

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
		.setName(`league-leaders`)
		.setDescription(`Get the current or past leaders of a specific statistic.`)
        .addStringOption(option => option.setName(`stat`).setDescription(`Which statistic you want to find league leaders for.`).addChoices({
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
            name: `Triple Doubles`,
            value: `TD3`
        }).addChoices({
            name: `Plus Minus (+/-)`,
            value: `PLUS_MINUS`
        }).addChoices({
            name: `Fantasy Points (FP)`,
            value: `NBA_FANTASY_PTS`
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
            name: `Usage Percentage (USG%)`,
            value: `USG_PCT`
        }).addChoices({
            name: `Player Impact Estimate (PIE)`,
            value: `PIE`
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

        let type = `Base`;
        if ([`AST_TO`, `OREB_PCT`, `DREB_PCT`, `EFG_PCT`, `TS_PCT`, `USG_PCT`, `PACE`, `PIE`, `POSS`].includes(stat)) type = `Advanced`;
        
        fetch(`https://stats.nba.com/stats/leaguedashplayerstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=&Location=&MeasureType=${type}&Month=0&OpponentTeamID=0&Outcome=&PORound=&PaceAdjust=N&PerMode=${mode}&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}-${(parseInt(season) + 1).toString().substring(2, 4)}&SeasonSegment=&SeasonType=${seasonType}&ShotClockRange=&StarterBench=&TeamID=&TwoWay=&VsConference=&VsDivision=&Weight=`, {
            headers: require(`../config.json`).headers
        }).then(async res => {
            let json = await res.text();
            json = JSON.parse(json);

            let embed = new Discord.MessageEmbed()
                .setTitle(`${teamEmojis.NBA} __${season}-${parseInt(season) + 1} ${seasonType.split(`+`).join(` `)} ${(mode == `PerGame`) ? `Per Game` : `Total`} League Leaders for ${stat}:__`)
                .setColor(teamColors.NBA);

            let leaders = json.resultSets[0].rowSet;
            let max = 20;
            let description = ``;

            // Locating where stat is
            let statPosition, statRankingPosition;
            for (var i = 0; i < json.resultSets[0].headers.length; i++) {
                if (json.resultSets[0].headers[i] == stat.toUpperCase()) {
                    statPosition = i;
                }
                if (json.resultSets[0].headers[i] == `${stat.toUpperCase()}_RANK`) {
                    statRankingPosition = i;
                }
            }
            if (!statPosition || !statRankingPosition) return await interaction.editReply(`An error occurred finding that stat.`);

            // Sorting by stat ranking
            leaders.sort((a, b) => {
                return a[statRankingPosition] - b[statRankingPosition];
            });

            for (var i = 0; i < max; i++) {
                if (stat.includes(`PCT`)) leaders[i][statPosition] = (parseFloat(leaders[i][statPosition]) * 100).toFixed(1);
                description += `\`${i < 9 ? `0` : ``}${i + 1})\` \`${leaders[i][statPosition]}\` - ${teamEmojis[teamNames[leaders[i][3]]]} **${leaders[i][1]}**\n`
            }

            embed.setDescription(description);

            if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

            return await interaction.editReply({ embeds: [embed] });
        });
	},
};
