// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const query = require(`../methods/database/query.js`);
const convertToPercentage = require(`../methods/convert-to-percentage.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Get the standings for either your server or around the world.')
		.addBooleanOption(option => option.setName(`global`).setDescription(`Whether you want the leaderboard requested to be global or just for your server.`)),
    
	async execute(variables) {
		let { interaction, con, client } = variables;

		await interaction.deferReply();

		let global = interaction.options.getBoolean(`global`);

		let users;
		if (global) {
			users = await query(con, `SELECT * FROM users ORDER BY Balance DESC;`);
		} else {
			users = await query(con, `SELECT * FROM users WHERE LOCATE("${interaction.guild.id}", Guilds) > 0 ORDER BY Balance DESC;`);
		}
		let totalUsers = users.length;

		let embed = new Discord.MessageEmbed()
			.setTitle(`${(global) ? `:earth_americas: Global ` : ``}Leaderboard${(global) ? `` : ` for ${interaction.guild.name}`} (${totalUsers} user${(totalUsers > 1) ? `s` : ``})`)
			.setColor(teamColors.NBA);

		let i = 0, authorObject, authorPosition;
		userLoop: for (var user of users) {
			// userArray.push(user);
			// Finding message author position
			let username = await client.users.fetch(user.ID);
			if (!username) continue userLoop;
			
			i++;
			if (i <= 10) {
				embed.addField(`${i}) @${username.username}#${username.discriminator} - \`$${user.Balance.toFixed(2).toString()}\``, `_Betting record:_ \`${user.Correct} - ${user.Wrong}\` (${convertToPercentage(user.Correct, user.Correct + user.Wrong)})`);
			}

			if (user.ID == interaction.user.id) {
				if (i > 10) {
					embed.addField(`${i}) @${username.username} - \`$${user.Balance.toFixed(2).toString()}\``, `_Betting record:_ \`${user.Correct} - ${user.Wrong}\` (${convertToPercentage(user.Correct, user.Correct + user.Wrong)})`);
					break userLoop;
				}
				authorObject = user;
				authorPosition = i;
			}

			if (authorObject && i > 10) break userLoop;
		}

		console.log(embed);

		return interaction.editReply({ embeds: [embed] });
ß
		// MySQL queries:
		// Server: SELECT * FROM users WHERE LOCATE("SERVER_ID", ServerIDs) > 0 ORDER BY Balance DESC;
		// Global: SELECT * FROM users ORDER BY Balance DESC;
	},
};
