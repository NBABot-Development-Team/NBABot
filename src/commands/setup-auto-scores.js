/*

/setup-auto-scores start
- if donator
- if >1 available channels
- start doing auto scores in this channel

/setup-auto-scores stop
- stop auto scores, gain +1 available channels

*/

// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Methods
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`setup-auto-scores`)
		.setDescription(`(for donators) choose where you want your automated scores to be`)
        .addStringOption(option => option.setName(`option`).setDescription(`Whether you want to start or stop live scores in this channel.`).addChoices({
            name: `Start`,
            value: `start`
        }).addChoices({
            name: `Stop`,
            value: `stop`
        }).setRequired(true)),
    
	async execute(variables) {
		let { con, interaction } = variables;

		let user = await query(con, `SELECT * FROM users WHERE ID = "${interaction.user.id}";`);
        user = user[0];

        // Checking if user is donator
        if (user.Donator != `y`) return await interaction.reply(`Only donators can use auto scores. To find out more, use \`/donate\`.`);

        
	},
};
