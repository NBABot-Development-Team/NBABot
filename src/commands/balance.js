// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);

// Methods
const getUser = require(`../methods/database/get-user.js`);
const convertToPercentage = require(`../methods/convert-to-percentage.js`);
const query = require(`../methods/database/query.js`);

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
            .setFooter({ text: `Note: the virtual currency used in NBABot's simulated betting system is NOT REAL and has no value.` })
            .setDescription(`Get an extra $10 in the simulated betting system by using \`/vote\`.`)
            .addField(`Description`, `${user.Description}`, false)
            .addField(`Balance`, `$${user.Balance.toFixed(2)}`, true)
            .addField(`Favourite Team`, `${user.FavouriteTeam} ${teamEmojis[user.FavouriteTeam]}`, true)
            .addField(`Donator`, (user.Donator == `y`) ? `Yes (NBA Chamption Donator)` : ((user.Donator == `f`) ? `Yes (Finals MVP Donator)` : `No`), true)
            .addField(`Betting Record`, `${user.Correct}-${user.Wrong} (${convertToPercentage(user.Correct, user.Correct + user.Wrong)})`, true);

        // Getting user position
        let globalPosition = await query(con, `SELECT * FROM ( SELECT ID, Balance, Correct, Wrong, Guilds, @row := @row + 1 AS serial_num FROM users CROSS JOIN (SELECT @row := 0) r ORDER BY Balance DESC ) tmp WHERE ID = "${interaction.user.id}";`);
        if (globalPosition) {
            if (globalPosition[0]) {
                if (globalPosition[0].serial_num) {
                    globalPosition = globalPosition[0].serial_num;
                    let totalGlobalCount = await query(con, `SELECT COUNT(*) FROM users;`);
                    totalGlobalCount = totalGlobalCount[0][`COUNT(*)`];
                    embed.addField(`Global Ranking :earth_americas:`, `${globalPosition}/${totalGlobalCount}`, true);
                }
            }
        }

        let guildPosition = await query(con, `SELECT * FROM ( SELECT ID, Balance, Correct, Wrong, Guilds, @row := @row + 1 AS serial_num FROM (SELECT * FROM users WHERE LOCATE("${interaction.guild.id}", Guilds) > 1 ) temp2 CROSS JOIN (SELECT @row := 0) r ORDER BY Balance DESC ) tmp WHERE ID = "${interaction.user.id}";`);
        if (guildPosition) {
            if (guildPosition[0]) {
                if (guildPosition[0].serial_num) {
                    guildPosition = guildPosition[0].serial_num;
                    let totalGuildCount = await query(con, `SELECT COUNT(*) FROM users WHERE LOCATE("${interaction.guild.id}", Guilds) > 0;`);
                    totalGuildCount = totalGuildCount[0][`COUNT(*)`];
                    embed.addField(`Server Ranking :trophy:`, `${guildPosition}/${totalGuildCount}`, true);
                }
            }
        }

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.reply({ embeds: [embed] });
	},
};
