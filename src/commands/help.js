// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`help`)
		.setDescription(`NBABot's commands and other useful info`),

	async execute(variables) {
		let { interaction, ad } = variables;

		const commands = {
			nba: [`scores`, `boxscore`, `player-stats`, `player-info`, `compare-players`, `standings`, `schedule`, `roster`, `team-info`, `team-stats`, `teams`, `news`, `transactions`, `all-time-leaders`, `league-leaders`, `franchise-leaders`],
			betting: [`bet`, `bets`, `balance`, `bets`, `claim`, `leaderboard`, `odds`, `rbet`, `reset-balance`, `weekly`],
			other: [`bot-stats`, `help`, `img-add`, `img-delete`, `img`, `imgs`, `ping`, `settings`, `vote`, `auto-scores`, `donate`, `ad-free-servers`],
		}

		let embed = new Discord.MessageEmbed()
			.setTitle(`Help for NBABot`)
			.setColor(teamColors.NBA)
			.setDescription(`Type / and select NBABot to see NBABot's commands.\n\n**Further questions?** Join the support server below or contact chig#4519 directly.\n**Want to support NBABot?** Donation via patreon below would be immensely appreciated.`)
			.addField(`NBA Commands`, `\`/${commands.nba.join(`\` \`/`)}\``)
			.addField(`Betting Commands`, `\`/${commands.betting.join(`\` \`/`)}\``)
			.addField(`Other Commands`, `\`/${commands.other.join(`\` \`/`)}\``)
			.setFooter({ text: `NBABot, made by chig#4519 and freejstn#0666` });

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
					.setURL(`https://github.com/EliotChignell/NBABot`)
					.setLabel(`GitHub`)
					.setStyle(`LINK`)
			);

		if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });
			
		await interaction.reply({ embeds: [embed], components: [row] });
	},
};
