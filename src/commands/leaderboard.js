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
		let { interaction, con, client, ad } = variables;

		await require(`../methods/update-peak-positions.js`)(con, interaction.user.id);

		await interaction.deferReply();

		let global = interaction.options.getBoolean(`global`);

		let medals = {
			1: `:first_place:`,
			2: `:second_place:`,
			3: `:third_place:`
		};

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
			let username = await client.users.fetch(user.ID);
			if (!username) continue userLoop;
			
			i++;
			if (i <= 10) {
				embed.addField(`${(user.ID == interaction.user.id) ? `__` : ``}${(i <= 3 ? medals[i] : i)}) \`$${user.Balance.toFixed(2).toString()}\` - ${username.username}#${username.discriminator}${(user.ID == interaction.user.id) ? `__` : ``}`, `_Betting record:_ \`${user.Correct} - ${user.Wrong}\` (${convertToPercentage(user.Correct, user.Correct + user.Wrong)})`);
			} else break;
		}

		// SELECT * FROM ( SELECT ID, Balance, Correct, Wrong, @row := @row + 1 AS serial_num FROM (SELECT * FROM users WHERE LOCATE("547294716606021643", Guilds) > 1 ) temp2 CROSS JOIN (SELECT @row := 0) r ORDER BY Balance DESC ) tmp WHERE ID = "401649168948396032";

		// Finding user position
		let position = await query(con, `SELECT * FROM ( SELECT ID, Balance, Correct, Wrong, Guilds, @row := @row + 1 AS serial_num FROM ${(global) ? `users` : `(SELECT * FROM users WHERE LOCATE("${interaction.guild.id}", Guilds) > 1 ) temp2`} CROSS JOIN (SELECT @row := 0) r ORDER BY Balance DESC ) tmp WHERE ID = "${interaction.user.id}";`);
		position = position[0];

		if (position) {
			if (position.serial_num > 10) {
				embed.addField(`...\n__${position.serial_num}) \`$${position.Balance.toFixed(2).toString()}\` - ${interaction.user.username}__`, `_Betting record:_ \`${position.Correct} - ${position.Wrong}\` (${convertToPercentage(position.Correct, position.Correct + position.Wrong)})`);
			}
		} else {
			embed.setFooter({ text: `Note: Your position in the leaderboard could not be found for some reason.` });
		}

		if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

		return interaction.editReply({ embeds: [embed] });
ß
		// MySQL queries:
		// Server: SELECT * FROM users WHERE LOCATE("SERVER_ID", ServerIDs) > 0 ORDER BY Balance DESC;
		// Global: SELECT * FROM users ORDER BY Balance DESC;
	},
};
