// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('vote')
		.setDescription('Get the link to vote for NBABot on top.gg for $10 in the simulated betting system.'),
    
	async execute(variables) {
		let { interaction } = variables;

		let embed = new Discord.MessageEmbed()
			.setDescription(`Vote for NBABot **[here](https://top.gg/bot/544017840760422417/vote)** every 12 hours to get $10 in the simulated betting system.`)
			.setColor(teamColors.NBA);

		return await interaction.reply({ embeds: [embed] });
	},
};
