// Libraries
const { SlashCommandBuilder } = require(`@discordjs/builders`);
const Discord = require(`discord.js`);
const wiki = require(`wikipedia`);
const fetch = require(`node-fetch`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const playerNames = require(`../assets/players/all/names.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);

// Methods
const searchForPlayers = require(`../methods/search-for-players.js`);
const convertHeightToMetric = require(`../methods/convert-height-to-metric.js`);
const getJSON = require(`../methods/get-json.js`);
const formatNumber = require(`../methods/format-number.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`player-info`)
		.setDescription(`Get basic information, and NBA awards of a specific player.`)
        .addStringOption(option => option.setName(`name`).setDescription(`An NBA player, e.g. LeBron James.`).setRequired(true).setAutocomplete(true)),

    async autocomplete(variables) {
        let { interaction } = variables;

        const focusedValue = interaction.options.getFocused();
        const choices = Object.values(require(`../assets/players/all/names.json`));
        const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    },

	async execute(variables) {
		let { interaction, ad } = variables;

        await interaction.deferReply();

		// Validating name input
        let requestedName = interaction.options.getString(`name`);
        let name = searchForPlayers(requestedName);
        if (!name) return await interaction.editReply(`No NBA players were found with the name \`${requestedName}\`.`);
        if (name.length > 1) { // Multiple possibilities, so uncertain
            let namesStr = ``, otherStr = ``;
            for (var i = 0; i < name.length; i++) {
                let addStr = `\`${playerNames[name[i]]}\`${(i == name.length - 1) ? `` : `, `}`;
                let temp = namesStr += addStr;
                if (temp.length >= 4096) {
                    otherStr += addStr;
                } else nameStr += addStr;
            }

            let embed = new Discord.MessageEmbed()
                .setColor(teamColors.NBA)
                .setTitle(`No specific player found, other players:`)
                .setDescription(namesStr);

            if (otherStr.length > 0) embed.addField(`...`, otherStr);

            return await interaction.editReply({ embeds: [embed] });
        }

        // Polishing up variables
        let id = name[0];
        name = playerNames[id];

        let embed = new Discord.MessageEmbed()
            .setTitle(`__Player information for ${name}:__`);

        // Adding wikipedia info
        try {
            const page = await wiki.page(name);
            const summary = await page.summary();

            embed.setDescription(`${summary.extract.substring(0, 256)}... [Wikipedia](${page.fullurl})`);
            embed.setThumbnail(summary.thumbnail.source);
        } catch (e) {
            console.log(e);
        }

        // Finding player info from NBA API
        const url = `https://stats.nba.com/stats/commonplayerinfo?LeagueID=&PlayerID=${id}`;
        let json = await fetch(url, {
            headers: require(`../config.json`).headers
        });
        if (!json.ok) return await interaction.editReply(`An error occurred fetching that information.`);
        json = await json.json();
        if (!json) return await interaction.editReply(`An error occurred fetching that information.`);

        // Parsing json info into objects
        let basicInfo = {};
        for (var i = 0; i < json.resultSets[0].headers.length; i++) {
            basicInfo[json.resultSets[0].headers[i]] = json.resultSets[0].rowSet[0][i];
        }
        let basicStats = {};
        for (var i = 0; i < json.resultSets[1].headers.length; i++) {
            basicStats[json.resultSets[1].headers[i]] = json.resultSets[1].rowSet[0][i];
        }

        if (teamColors[basicInfo[`TEAM_ABBREVIATION`]]) {
            embed.setColor(teamColors[basicInfo[`TEAM_ABBREVIATION`]]);
        } else embed.setColor(teamColors.NBA);

        embed.addField(`Team`, `\`${basicInfo[`TEAM_ABBREVIATION`]}\` ${teamEmojis[basicInfo[`TEAM_ABBREVIATION`]]}`, true);
        embed.addField(`Jersey Number`, `\`#${basicInfo[`JERSEY`]}\``, true);
        embed.addField(`Position`, `\`${basicInfo[`POSITION`]}\``, true);
        embed.addField(`Height`, `\`${basicInfo[`HEIGHT`].split(`-`)[0]}'${basicInfo[`HEIGHT`].split(`-`)[1]}" / ${convertHeightToMetric(parseFloat(basicInfo[`HEIGHT`].split(`-`)[0]), parseFloat(basicInfo[`HEIGHT`].split(`-`)[1])).toFixed(2)}m\``, true);
        embed.addField(`Weight`, `\`${basicInfo[`WEIGHT`]}lbs / ${(parseFloat(basicInfo[`WEIGHT`]) * 0.453592).toFixed(1)}kg\``, true);
        embed.addField(`Date of Birth`, `\`${new Date(basicInfo[`BIRTHDATE`]).toDateString()}\``, true);
        embed.addField(`Drafted`, `\`${(basicInfo[`DRAFT_YEAR`] != `Undrafted`) ? `#${basicInfo[`DRAFT_NUMBER`]} (${basicInfo[`DRAFT_YEAR`]})` : `Undrafted`}\``, true);
        embed.addField(`Last Affiliation`, `\`${basicInfo[`LAST_AFFILIATION`]}\``, true);
        embed.addField(`NBA Career`, `\`${basicInfo[`FROM_YEAR`]}-${basicInfo[`TO_YEAR`]}\``, true);
        embed.addField(`Part of NBA75`, `\`${basicInfo[`GREATEST_75_FLAG`] == `Y` ? `Yes` : `No`}\``, true);
        embed.addField(`Player ID`, `\`${basicInfo[`PERSON_ID`]}\``, true);
        
        // Checking for injuries as well
        let json2 = await getJSON(`https://www.rotowire.com/basketball/tables/injury-report.php?pos=ALL&team=ALL`);

        let str1 = `Current Injury`, str2 = `None`;
        if (json2 instanceof Array) {
            if (json2.length > 0) {
                for (var i = 0; i < json2.length; i++) {
                    if (name.toLowerCase() == json2[i].player.toLowerCase()) {
                        str2 = `\`${json2[i].status} - ${json2[i].injury}\``;
                    }
                }
            }
        }
        embed.addField(str1, str2, true);

        let awards = await fetch(`https://stats.nba.com/stats/playerawards?PlayerID=${id}`, {
            headers: require(`../config.json`).headers
        });

        if (awards.ok) {
            awards = await awards.json();

            awards = awards.resultSets[0].rowSet;

            let team = {"All-NBA": [], "All-Defensive Team": [], "All-Rookie Team": []};
            let award = {"NBA Most Valuable Player": [], "NBA Defensive Player of the Year": [], "NBA Finals Most Valuable Player": [], "NBA Rookie of the Year": []};
            for (var k = 0; k < awards.length; k++) {
                if (team[awards[k][4]]) {
                    team[awards[k][4]].push({ team: awards[k][5], season: awards[k][6] });
                } else if (award[awards[k][4]]) {
                    award[awards[k][4]].push(awards[k][6]);
                }
            }

            let str1t = `__Team Selections__`, str2t = ``, str1a = `__Awards__`, str2a = ``;

            typeLoop: for (var type in team) {
                if (team[type].length == 0) continue typeLoop;
                
                str2t += `***${type} (${team[type].length}):***\n`;

                let str2tt = [];
                for (var k = 0; k < team[type].length; k++) {
                    str2tt.push(`${formatNumber(team[type][k].team)} (${team[type][k].season})`);
                }

                str2t += str2tt.join(`, `);
                str2t = `${str2t}\n\n`;
            }

            if (basicStats[`ALL_STAR_APPEARANCES`]) str2t += `***All-Star Appearances:*** ${basicStats[`ALL_STAR_APPEARANCES`]}`;

            typeLoop: for (var type in award) {
                if (award[type].length == 0) continue typeLoop;

                str2a += `***${type} (${award[type].length}):***\n${award[type].join(`, `)}\n\n`;
            }

            if (str2t) embed.addField(str1t, str2t);
            if (str2a) embed.addField(str1a, str2a);
        }

        // Adding preview stats
        embed.addField(`__${basicStats[`TimeFrame`][0].toUpperCase()}${basicStats[`TimeFrame`].substring(1, basicStats[`TimeFrame`].length)} Stats__`, `\`${basicStats[`PTS`]}\` PTS, \`${basicStats[`AST`]}\` AST, \`${basicStats[`REB`]}\` REB${basicStats[`PIE`] ? `, \`${(parseFloat(basicStats[`PIE`]) * 100).toFixed(1)}\` PIE` : ``}.`);
        embed.setFooter({ text: `See more stats with \`/player-stats name: ${name}\`` });

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.editReply({ embeds: [embed] });
    },
};
