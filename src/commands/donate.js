// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`donate`)
		.setDescription(`Find out more about becoming a patron to NBABot's development.`),
    
	async execute(variables) {
		let { interaction } = variables;

        let embed = new Discord.MessageEmbed()
            .setColor(teamColors.NBA)
            .setTitle(`Information about donation to NBABot:`)
            .addField(`NBABot is a project that we've really enjoyed working on and we likewise hope that you all enjoy and appreciate what NBABot can do.`, `As NBABot has grown from 10 to 10,000 servers, more and more people have been using it, giving us valuable suggestions, feedback, and inspiration for more to come.\n\n**This growth has also meant that I (chig) have needed to pay more and more for server costs. Donation is really critical to ensure I can keep NBABot going with it's almost 100% free features.**\nAny support in any form is immensely appreciated and if you are interested about donating, visit the link below:\n[patreon.com/nbabot](https://patreon.com/nbabot)`);

        return await interaction.reply({ embeds: [embed] });
	},
};
