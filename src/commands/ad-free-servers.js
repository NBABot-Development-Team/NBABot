// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Methods
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ad-free-servers')
		.setDescription('(Donator only) Remove ads from your server')
		.addStringOption(option => option.setName(`option`).setDescription(`Either add/remove/check your add-free servers.`).addChoices({
			name: `Add`,
			value: `add`
		}).addChoices({
			name: `Remove`,
			value: `remove`
		}).addChoices({
			name: `Check`,
			value: `check`
		}).setRequired(true)),
    
	async execute(variables) {
		let { interaction, con, client } = variables;

		let option = interaction.options.getString(`option`);

		let user = await query(con, `SELECT * FROM users WHERE ID = "${interaction.user.id}";`);
        user = user[0];

		if (![`y`, `f`].includes(user.Donator)) return await interaction.reply(`Only donators can remove ads from a server. Learn more with \`/donate\`.`);

		let AdFreeServers = user.AdFreeServer.split(`,`), serverNames = [];
		switch(option) {
			case `add`:
				if (AdFreeServers.length == 0) {
					AdFreeServers.push(interaction.guild.id);
					await query(con, `UPDATE users SET AdFreeServer = "${AdFreeServers.join(`,`)}" WHERE ID = "${interaction.user.id}";`);
					return await interaction.reply(`Success! Your ad-free servers are now: \`${interaction.guild.name}\`.`);
				} else if (AdFreeServers.length >= 1 && user.Donator == `y`) {
					return await interaction.reply(`NBA Champion Donators can only have 1 ad-free server. Use \`/ad-free-servers remove\` in another server to remove that server from the list.`);
				}  else if (AdFreeServers.length <= 2) {
					AdFreeServers.push(interaction.guild.id);
					await query(con, `UPDATE users SET AdFreeServer = "${AdFreeServers.join(`,`)}" WHERE ID = "${interaction.user.id}";`);
					for (var i = 0; i < AdFreeServers.length; i++) {
						let guild = await client.guilds.fetch(AdFreeServers[i]);
						serverNames.push(guild.name);
					}
					return await interaction.reply(`Success! Your ad-free servers are now: \`${serverNames.join(`, `)}\`.`);
				} else if (AdFreeServers.length >= 3) {
					return await interaction.reply(`Finals MVP Donators can only have 3 ad-free servers. Use \`/ad-free-servers remove\` in another server to remove that server from the list.`);
				} else return await interaction.reply(`Unknown error.`);
				break;

			case `remove`:
				if (AdFreeServers.length == 0) return await interaction.reply(`You currently do not have any ad-free servers. Add them with \`/ad-free-servers add\`.`);
				
				let foundServer = false;
				for (var i = 0; i < AdFreeServers.length; i++) {
					if (interaction.guild.id == AdFreeServers[i]) {
						AdFreeServers.splice(i, 1);
						foundServer = true;
					} else {
						let guild = await client.guilds.fetch(AdFreeServers[i]);
						serverNames.push(guild.name);
					}
				}
				if (!foundServer) return await interaction.reply(`This server is not an ad-free server and thus you cannot remove it. Add it as an ad-free server with \`/ad-free-servers add\`.`);

				await query(con, `UPDATE users SET AdFreeServer = "${AdFreeServers.join(`,`)}" WHERE ID = "${interaction.user.id}";`);

				return await interaction.reply(`Success! Your ad-free servers are now: \`${serverNames.join(`, `)}\`.`);
				break;

			case `check`:
				if (AdFreeServers.length == 0) return await interaction.reply(`You have no ad-free servers.`);
				for (var i = 0; i < AdFreeServers.length; i++) {
					let guild = await client.guilds.fetch(AdFreeServers[i]);
					serverNames.push(guild.name);
				}
				return await interaction.reply(`Your ad-free servers are: \`${serverNames.join(`, `)}\`.`);
				break;

			default:
				return;
				break;
		}
	},
};
