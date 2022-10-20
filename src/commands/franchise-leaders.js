// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamIDs = require(`../assets/teams/ids.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);

// Methods
const formatTeam = require(`../methods/format-team.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`franchise-leaders`)
		.setDescription(`Get franchise leaders for a certain team.`)
        .addStringOption(option => option.setName(`team`).setDescription(`An NBA team, e.g. PHX, Suns, or Phoenix.`).setRequired(true)),
    
	async execute(variables) {
		let { interaction, ad } = variables;

		let team = interaction.options.getString(`team`);
        team = formatTeam(team);
        if (!team) return await interaction.reply(`Please use a valid team. Use \`/teams\` to see all of them.`);

        fetch(`https://stats.nba.com/stats/franchiseleaders?LeagueID=&TeamID=${teamIDs[team]}`, {
            headers: require(`../config.json`).headers
        }).then(async res => {
            let json = await res.text();
            json = JSON.parse(json);
            json = json.resultSets[0];

            let embed = new Discord.MessageEmbed()
                .setTitle(`__Franchise leaders for the ${teamEmojis[team]} ${teamNicknames[team]}:__`)
                .setColor(teamColors[team]);

            let leaders = json.rowSet[0];
            embed.addField(`PTS`, `\`${leaders[1]}\` - **${leaders[3]}**`);
            embed.addField(`AST`, `\`${leaders[4]}\` - **${leaders[6]}**`);
            embed.addField(`REB`, `\`${leaders[7]}\` - **${leaders[9]}**`);
            embed.addField(`BLK`, `\`${leaders[10]}\` - **${leaders[12]}**`);
            embed.addField(`STL`, `\`${leaders[13]}\` - **${leaders[15]}**`);

            if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

            return await interaction.reply({ embeds: [embed] });
        });
	},
};
