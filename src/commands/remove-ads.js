// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Methods
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remove-ads')
		.setDescription('(Donator only) Remove ads from your server'),
    
	async execute(variables) {
		let { interaction, con } = variables;

		let user = await query(con, `SELECT * FROM users WHERE ID = "${interaction.user.id}";`);
        user = user[0];

        if (![`y`, `f`].includes(user.Donator)) return await interaction.reply(`Only donators can remove ads from a server. Learn more with \`/donate\`.`);

        await query(con, `UPDATE users SET AdFreeServer = "${interaction.guild.id}" WHERE ID = "${interaction.user.id}";`);

        return await interaction.reply(`Success! This server should no longer have ads. Note: there can only be 1 ad-free server per user at a time.`);
	},
};
