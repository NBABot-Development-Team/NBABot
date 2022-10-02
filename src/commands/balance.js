// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);

// Methods
const getUser = require(`../methods/database/get-user.js`);
const createUser = require(`../methods/database/create-user.js`);
const convertToPercentage = require(`../methods/convert-to-percentage.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('balance')
		.setDescription('Get your balance in the simulated bettings system.'),
    
	async execute(variables) {
		let { interaction, con, ad } = variables;

        let user = await getUser(con, `users`, interaction.user.id);
        user = user[0];

        let embed = new Discord.MessageEmbed()
            .setTitle(`__Balance for user ${interaction.user.tag}:__`)
            .setColor((user.FavouriteTeam == `NBA`) ? `#FF4242` : teamColors[user.FavouriteTeam])
            .setThumbnail(interaction.user.avatarURL())
            .setDescription(`Get an extra $10 in the simulated betting system by using \`/vote\`.`)
            .addField(`Description`, `${user.Description}`, false)
            .addField(`Balance`, `$${user.Balance.toFixed(2)}`, true)
            .addField(`Favourite Team`, `${user.FavouriteTeam} ${teamEmojis[user.FavouriteTeam]}`, true)
            .addField(`Donator`, (user.Donator == `y`) ? `Yes (NBA Chamption Donator)` : ((user.Donator == `f`) ? `Yes (Finals MVP Donator)` : `No`), true)
            .addField(`Betting Record`, `${user.Correct}-${user.Wrong}`, true)
            .addField(`Accuracy`, convertToPercentage(user.Correct, user.Correct + user.Wrong), true);

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.reply({ embeds: [embed] });
	},
};
