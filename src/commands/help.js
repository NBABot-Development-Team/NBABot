// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`help`)
		.setDescription(`NBABot's commands and other useful info`),

	async execute(variables) {
		let { interaction, ad, con, betting } = variables;

		delete require.cache[require.resolve(`../config.json`)];
		const config = require(`../config.json`);

		const commands = config.commands;

		let ordered = {};

		for (var key in commands) {
			if (!betting && key == `betting`) continue;

			let sums = [];
			for (var i = 0; i < commands[key].length; i++) {
				let command = commands[key][i];
				if (command.includes(`-`)) command = command.split(`-`).join(``);

				let sum;
				try {
					sum = await query(con, `SELECT SUM(${command}) AS sum FROM stats;`);
				} catch (e) {
					sum = 0;
				}
				if (sum) sum = sum[0].sum;
				else sum = 0;

				sums.push([commands[key][i], sum]);
			}
			// [[scores, 123], [playerstats, 456]]
			sums = sums.sort((a, b) => {
				return b[1] - a[1];
			});
			if (!ordered[key]) ordered[key] = [];
			for (var i = 0; i < sums.length; i++) {
				ordered[key].push(sums[i][0]);
			}
		}

		let embed = new Discord.MessageEmbed()
			.setTitle(`Help for NBABot`)
			.setColor(teamColors.NBA)
			.setDescription(`Type / and select NBABot to see NBABot's commands.\n\n**Further questions?** Join the support server below or contact chig#4519 directly.\n**Want to support NBABot?** Donation via patreon below would be immensely appreciated.`)
			.addField(`NBA Commands`, `\`/${ordered.nba.join(`\` \`/`)}\``)
			.addField(`Other Commands`, `\`/${ordered.other.join(`\` \`/`)}\``)
			.setFooter({ text: `NBABot, made by chig#4519 and freejstn#0666` });

		if (betting && ordered.betting) embed.addField(`Betting Commands (Note: NBABot's simulated betting system uses NO real money/currency.)`, `\`/${ordered.betting.join(`\` \`/`)}\``);

		const row = new Discord.MessageActionRow()
			.addComponents(
				new Discord.MessageButton()
					.setURL(`https://invite.gg/nbabot`)
					.setLabel(`Join support server`)
					.setStyle(`LINK`),

				new Discord.MessageButton()
					.setURL(`https://nbabot.js.org`)
					.setLabel(`NBABot website`)
					.setStyle(`LINK`),

				new Discord.MessageButton()
					.setURL(`https://patreon.com/nbabot`)
					.setLabel(`Donate`)
					.setStyle(`LINK`),

				new Discord.MessageButton()
					.setURL(`https://top.gg/bot/544017840760422417/vote`)
					.setLabel(`Vote`)
					.setStyle(`LINK`),

				new Discord.MessageButton()
					.setURL(`https://github.com/NBABot-Development-Team/NBABot`)
					.setLabel(`GitHub`)
					.setStyle(`LINK`)
			);

		if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });
			
		await interaction.reply({ embeds: [embed], components: [row] });
	},
};
