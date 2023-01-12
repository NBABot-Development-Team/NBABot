// Libraries
const { SlashCommandBuilder } = require(`@discordjs/builders`);
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamNames = require(`../assets/teams/names.json`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`standings`)
		.setDescription(`Get NBA standings for a specific season and/or conference/division.`)
        .addStringOption(option => option.setName(`setting`).addChoices({
            name: `League`,
            value: `league`
        }).addChoices({
            name: `Eastern Conference`,
            value: `east`
        }).addChoices({
            name: `Western Conference`,
            value: `west`
        }).addChoices({
            name: `Atlantic Divison`,
            value: `atlantic`
        }).addChoices({
            name: `Central Division`,
            value: `central`
        }).addChoices({
            name: `Southeast Division`,
            value: `southeast`
        }).addChoices({
            name: `Northwest Division`,
            value: `northwest`
        }).addChoices({
            name: `Pacific Division`,
            value: `pacific`
        }).addChoices({
            name: `Southwest Division`,
            value: `southwest`
        }))
        .addStringOption(option => option.setName(`season`).setDescription(`An NBA season, e.g. 2019-2020, 2019-20, or 2019.`)),
    
	async execute(variables) {
		let { interaction, ad } = variables;

        await interaction.deferReply();

		let season = interaction.options.getString(`season`);
        let setting = interaction.options.getString(`setting`);

        if (season) {
            season = formatSeason(season);
            if (!season) return await interaction.editReply(`Please use a valid season format, e.g. 2022-2023, 2017-18, or 2019.`);
        } else {
            delete require.cache[require.resolve(`../cache/today.json`)];
            season = require(`../cache/today.json`).seasonScheduleYear;
        }
        if (!setting) setting = `both`;

        if (season < 1970) return await interaction.editReply(`The earliest season for available NBA standings is 1970-1971.`);

        const url = `https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season=${season}-${(parseInt(season) + 1).toString().substring(2, 4)}&SeasonType=Regular+Season&SeasonYear=`;
        let json = await fetch(url, {
            headers: require(`../config.json`).headers
        });

        if (!json.ok) return await interaction.editReply(`An error occurred fetching that information.`);
        json = await json.json();
        if (!json) return await interaction.editReply(`An error occurred fetching that information.`);

        let h = json.resultSets[0].headers;
        let s = json.resultSets[0].rowSet;
        let sh = {};
        for (var i = 0; i < h.length; i++) {
            sh[h[i]] = i;
        }

        let str = {
            league: [`League Standings`, ``],
            east: [`Eastern Conference Standings`, ``],
            west: [`Western Conference Standings`, ``],
            atlantic: [`Atlantic Division Standings`, ``],
            central: [`Central Division Standings`, ``],
            southeast: [`Southeast Division Standings`, ``],
            northwest: [`Northwest Division Standings`, ``],
            pacific: [`Pacific Division Standings`, ``],
            southwest: [`Southwest Division Standings`, ``]
        };

        let counter = 0;

        for (var i = 0; i < s.length; i++) {
            if ([`east`, `west`].includes(setting) && setting != s[sh[`Conference`]].toLowerCase()) continue;
            if ([`atlantic`, `central`, `southeast`, `northwest`, `pacific`, `southwest`].includes(setting) && setting != s[sh[`Division`]].toLowerCase()) continue;
            counter++;

            // Getting str2 for team, then will decide where to put in str object
            // XX) E PHX | XX-XX .XXX 00.0 WX
            let tricode = teamNames[s[sh[`TeamID`]]];
            let rank = counter, emoji = teamEmojis[tricode], record, pct, gb, streak;


            let str2 = `\n\`${rank} \`${emoji}\` ${team} | ${record} ${pct} ${gb} ${streak}\``;
        }
	},
};
