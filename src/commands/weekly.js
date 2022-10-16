// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Methods
const query = require(`../methods/database/query.js`);
const formatDuration = require(`../methods/format-duration.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('weekly')
		.setDescription('If you are a donator, you can get $20 in the simulated betting system per week with this command.'),
    
	async execute(variables) {
		let { interaction, con } = variables;

        let user = await query(con, `SELECT * FROM users WHERE ID = "${interaction.user.id}";`);
        user = user[0];

        if (user.Donator != `y` && user.Donator != `f`) return await interaction.reply(`\`/weekly\` is only available to donators. To become a donator, use \`/donate\` and if you are indeed a donator, contact chig#4519 to sort this out.`);

        let lastWeekly = parseInt(user.LastWeekly);
        let current = new Date().getTime();

        // Each 6d 12h
        if (current - 6.5 * 86400 > lastWeekly) { // Yes 
            user.Balance += (user.Donator == `y`) ? 20 : 50;
            user.LastWeekly = new Date().getTime().toString();
            await query(con, `UPDATE users SET Balance = ${user.Balance.toFixed(2)}, LastWeekly = "${user.LastWeekly}" WHERE ID = "${interaction.user.id}";`);

            return await interaction.reply(`Success! Your balance is now \`$${user.Balance.toFixed(2)}\` and you can use \`/weekly\` ${formatDuration(parseInt(user.LastWeekly) + 6.5 * 86400000)}`);
        } else return await interaction.reply(`You can use \`/weekly\` again ${formatDuration(parseInt(user.LastWeekly) + 6.5 * 86400000)}.`);
	},
};
