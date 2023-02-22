// Libraries
const { SlashCommandBuilder } = require(`@discordjs/builders`);
const Discord = require(`discord.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`prop`)
		.setDescription(`Bet an amount on an over/under for a player's stats on a given game.`)
        .addStringOption(option => option.setName(`prop`).setDescription(`Start typing a player's name to find their available props.`).setAutocomplete(true).setRequired(true))
        .addStringOption(option => option.setName(`amount`).setDescription(`The amount you want to bet on this prop.`).setRequired(true)),
    
	async autocomplete(variables) {
		let { interaction } = variables;

		// Getting currentDate
		delete require.cache[require.resolve(`../cache/today.json`)];
		const currentDate = require(`../cache/today.json`).links.currentDate;

		const focusedValue = interaction.options.getFocused();
		const choices = require(`../cache/${currentDate}/props.json`).available;
		const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);
		await interaction.respond(
			filtered.map(choice => ({ name: choice, value: choice }))
		);
	},
    
    async execute(variables) {
		let { interaction } = variables;

        return await interaction.reply(`Test!`);
	},
};
