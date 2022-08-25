// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const { DurationFormatter } = require("@sapphire/time-utilities");
const durationFormatter = new DurationFormatter();
const { version } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
	.setName(`bot-stats`)
	.setDescription(`Shows NBABot's Stats`),

	execute: async function(variables) {
		let { interaction, client } = variables;

		let totalGuilds = await client.shard.fetchClientValues(`guilds.cache.size`);
		totalGuilds = totalGuilds.reduce((a, b) => a + b, 0);

		let totalUsers = await client.shard.fetchClientValues(`users.cache.size`);
		totalUsers = totalUsers.reduce((a, b) => a + b, 0);

		const duration = durationFormatter.format(client.uptime);
		let embed = new Discord.MessageEmbed()
			.setTitle(`Hi, I'm NBABot!`)
			.setDescription(`I am currently serving ${totalUsers} users in ${totalGuilds} servers. I have been running for ${duration}, and I'm currently using ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB of memory. I am running discord.js v${version} and node ${process.version}.`)
			.setFooter(`NBABot, made by chig#4519 and freejstn#0666`);
			
		await interaction.reply({ embeds: [embed]});
	}
};
