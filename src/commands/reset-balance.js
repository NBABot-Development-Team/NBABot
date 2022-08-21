// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const getUser = require(`../methods/database/get-user.js`);
const updateUser = require(`../methods/database/update-user.js`);
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`reset-balance`)
		.setDescription(`If you are at $0 and have no placed bets, use this to reset back to $10. (until voting added back)`),
    
	async execute(variables) {
		let { interaction, con } = variables;

        let user = await getUser(con, `users`, interaction.user.id);
        let bets = await getUser(con, `bets`, interaction.user.id);
        user = user[0];
        bets = bets[0];

        let placedBets = 0;
        for (var key in bets) {
            if (key == `ID`) continue;
            if (!bets[key]) continue;

            placedBets++;
        }

        if (user.Balance > 0) {
            return await interaction.reply(`Your balance is higher than $0. (\`${user.Balance.toFixed(2)}\`)`);
        }

        if (placedBets > 0) {
            return await interaction.reply(`Unforunately, you have placed bets. Use \`/bets\` to see them, \`/claim\` to claim bets from finished games, and \`/rbet\` to cancel bets on games yet to start.`);
        }

        // Success!
        user.Balance = 10;
        await updateUser(con, `users`, interaction.user.id, user);

        return await interaction.reply(`Success! Your balance is now \`$10\`.`);
	},
};
