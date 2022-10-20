// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);

// Methods
const getJSON = require(`../methods/get-json.js`);
const getHTML = require(`../methods/get-html.js`);
const formatSeason = require(`../methods/format-season.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`standings`)
		.setDescription(`Get the current league, conference or division standings.`)
        .addStringOption(option => option.setName(`season`).setDescription(`A season, e.g. 2022-2023, 2017-18, or 2019. This will default to the current season.`)),
    
	async execute(variables) {
		let { interaction, ad } = variables;

		let season = interaction.options.getString(`season`);

        if (season) {
            season = formatSeason(season);
            if (!season) return await interaction.reply(`Please use a valid season format, e.g. 2022-2023, 2017-18, or 2019.`);
        }

        let teams, json;

        // Getting current season
        delete require.cache[require.resolve(`../cache/today.json`)];
        const seasonScheduleYear = require(`../cache/today.json`).seasonScheduleYear;

        json = await getHTML(`https://www.espn.com/nba/standings/${(season) ? `_/season/${season}` : ``}`);

        json = json.substring(json.search(`{"app":`), json.length);
        json = json.substring(0, json.search(`};`) + 1); 
        json = JSON.parse(json);
        json = json.page.content.standings.groups.groups;

        /* switch (setting) {
            case `atlantic`:
            case `central`:
            case `southeast`:
            case `south east`:
            case `south-east`:
            case `northwest`:
            case `north west`:
            case `north-west`:
            case `pacific`:
            case `southwest`:
            case `south west`:
            case `south-west`:
                // Division standings
                setting = setting.split(`-`).join(``).split(` `).join(``);

                json = await getJSON(`http://data.nba.net/10s/prod/v1/current/standings_division.json`);

                conferenceLoop: for (var conference in json.league.standard.conference) {
                    teams = json.league.standard.conference[conference][setting];
                    if (!teams) return await interaction.reply(`Please use a valid NBA division: \`atlantic\`, \`central\`, \`southeast\`, \`northwest\`, \`pacific\`, or \`southwest\`.`);
                    break conferenceLoop;
                }
                break;

            case `eastern`:
            case `east`:
            case `e`:
            case `western`:
            case `west`:
            case `w`:
                // Conference standings
                setting = (setting[0] == `e`) ? `east` : `west`;

                json = await getJSON(`http://data.nba.net/10s/prod/v1/current/standings_conference.json`);

                teams = json.league.standard.conference[setting];
                if (!teams) return await interaction.reply(`Please use a valid NBA conference: \`east\` or \`west\`.`);
                break;

            case `league`:
                // League standings
                json = await getJSON(`http://data.nba.net/10s/prod/v1/current/standings_all.json`);
                teams = json.league.standard.teams;
                if (!teams) return await interaction.reply(`An error occured fetching league standings.`)
                break;

            default:
                return await interaction.reply(`Please specify a conference (\`east\`, \`west\`), division (\`atlantic\`, \`central\`, \`southeast\`, \`northwest\`, \`pacific\`, \`southwest\`), or just leave blank for league standings.`);
                break;
        }*/

        let embed = new Discord.MessageEmbed()
            .setTitle(`${seasonScheduleYear}-${seasonScheduleYear + 1} League Standings:`)
            .setColor(teamColors.NBA);
            
        let w = 10, l = 6, g = 4, s = 8;
        if (season) {
            w++; l++; g++; s++;
        }

        for(var k = 0; k < json.length; k++) {
            let description = `\`     Team    W-L  PCT GB   STR\`\n`;

            let teams = json[k].standings;
            
            let top = 0;
            for (var i = 0; i < teams.length; i++) {
                let len = teams[i].stats[w].length + teams[i].stats[l].length + 1;
                if (len > top) top = len;
            }
            for (var i = 0; i < teams.length; i++) {
                let solutions = { "UTAH": "UTA", "GS": "GSW", "NY": "NYK", "SA": "SAS", "NO": "NOP", "WSH": "WAS" };
                if (solutions[teams[i].team.abbrev]) teams[i].team.abbrev = solutions[teams[i].team.abbrev];
                if (teams[i].stats[g] == `-`) teams[i].stats[g] = `0`;

                let team = teams[i];
                let record = ``;
                if (team.stats[w].length + team.stats[l].length + 1 < top) {
                    for (var j = 0; j < top - (team.stats[w].length + team.stats[l].length + 1); j++) {
                        record += ` `;
                    }
                    record += `${team.stats[w]}-${team.stats[l]}`;
                } else record = `${team.stats[w]}-${team.stats[l]}`;

                let percentage = ((parseInt(team.stats[w]) / (parseInt(team.stats[w]) + parseInt(team.stats[l]))) * 100).toPrecision(3);
                if (parseInt(team.stats[w]) + parseInt(team.stats[l]) == 0) percentage = `0.00`;
                else if (parseInt(team.stats[l]) == 0) percentage = `100 `;

                if (parseFloat(team.stats[g]) - Math.floor(parseFloat(team.stats[g])) == 0) team.stats[g] = `${team.stats[g]}.0`;

                if (team.stats[s] == `-`) team.stats[s] = `- `;
                description += `\`${(i + 1 < 10) ? `0${i + 1}` : i + 1}) \`${teamEmojis[team.team.abbrev]}\`${team.team.abbrev} | ${record} ${percentage} ${(parseFloat(team.stats[g]) < 10) ? `0${parseFloat(team.stats[g]).toFixed(1)}` : parseFloat(team.stats[g]).toFixed(1)}  ${team.stats[s]}\`\n`;
            }

            embed.addField(`${json[k].name} Standings:`, description);
        }

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.reply({ embeds: [embed] });
	},
};
