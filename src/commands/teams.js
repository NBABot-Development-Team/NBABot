// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamDetails = require(`../assets/teams/details.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`teams`)
		.setDescription(`Get the names and tricodes for all NBA teams.`),
    
	async execute(variables) {
		let { interaction } = variables;

        let embed = new Discord.MessageEmbed()
            .setTitle(`NBA Team Names`)
            .setColor(teamColors.NBA)
            .setFooter(`NBABot is made by chig#4519 and freejstn#0666`);

        let description = ``;

        for (var i = 0; i < teamDetails.league.standard.length; i++) {
            let team = teamDetails.league.standard[i];
            if (!teamNicknames[team.tricode] || !teamEmojis[team.tricode]) continue;

            description += `${teamEmojis[team.tricode]}: \`${team.tricode}\`/\`${teamNicknames[team.tricode]}\`\n`;
        }

        embed.setDescription(description);

        return await interaction.reply({ embeds: [embed] });
	},
};
