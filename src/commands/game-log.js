// Libraries
const { SlashCommandBuilder } = require(`@discordjs/builders`);
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);

// https://cdn.nba.com/headshots/nba/latest/1040x760/1626164.png

// Assets
const playerNames = require(`../assets/players/nba/names.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const searchPlayers = require(`../methods/search-players.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`game-log`)
		.setDescription(`Get basic statistics for the most recent performances of a specific current NBA player.`)
        .addStringOption(option => option.setName(`name`).setDescription(`The name of a current NBA player, e.g. LeBron James.`).setRequired(true).setAutocomplete(true)),

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

        let name = interaction.options.getString(`name`);

        let possible = searchPlayers(name);

        if (!possible) return await interaction.editReply(`No players could be found with the name \`${name}\`.`);
        if (!(possible instanceof Array)) { // Uncertain
            let embed = new Discord.MessageEmbed()
                .setTitle(`No specific player was found`)
                .setColor(teamColors.NBA);

            for (var key in possible) {
                if (key == `bdl`) continue;
                if (Object.keys(possible[key]).length > 0) {
                    let str1 = (key == `nba`) ? `Possible players since 2016-17:` : `Possible players before 2016-17:`;
                    let str2 = ``;
                    for (var i = 0; i < Object.keys(possible[key]).length; i++) {
                        str2 += `\`${possible[key][Object.keys(possible[key])[i]]}\` `;
                    }
                    embed.addField(str1, str2);
                }
            }

            return await interaction.editReply({ embeds: [embed] });
        }

        let id = possible[1];
        name = playerNames[id];

        let season = require(`../cache/today.json`).seasonScheduleYear;

        let json = await fetch(`https://stats.nba.com/stats/playergamelog?DateFrom=&DateTo=&LeagueID=&PlayerID=${id}&Season=${season}-${(parseInt(season) + 1).toString().substring(2, 4)}&SeasonType=Regular+Season`, {
            headers: require(`../config.json`).headers
        });

        if (!json.ok) return await interaction.editReply(`An error occurred fetching that information. [Code: \`F0\`]`);
        json = await json.json();
        json = json.resultSets[0].rowSet;

        let description = ``;
        let counter = 0;
        for (var i = 0; i < json.length; i++) {
            if (i >= 10) break;
            description += `**\`${json[i][3]}\` \`${json[i][5]}\` \`${json[i][4].split(` `)[1][0]}\` ${teamEmojis[json[i][4].split(` `)[2]]} \`${json[i][4].split(` `)[2]}\`**:\n\`${json[i][24]}\`pts, \`${json[i][18]}\`reb, \`${json[i][19]}\`ast, \`${json[i][21]}\`blk, \`${json[i][20]}\`stl, \`${json[i][23]}\`pf, \`${json[i][22]}\`tov\n\n`;
        }

        let lastNum = (json.length < 10) ? json.length : 10;
        let teamTricode = json[0][4].split(` `)[0];

        let embed = new Discord.MessageEmbed()
            .setTitle(`__Last ${lastNum} games played by ${name}:__`)
            .setColor(teamColors[teamTricode])
            .setThumbnail(`https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`)
            .setDescription(description);

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.editReply({ embeds: [embed] });
	},
};
