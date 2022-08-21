// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	
	async execute(variables) {
		let { interaction } = variables;

		let embed = new Discord.MessageEmbed()
			.setTitle(`Pong!`);

		await interaction.reply({ embeds: [embed] });
	},
};
