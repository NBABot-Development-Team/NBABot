// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);

// Methods
const query = require('../methods/database/query');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bets')
		.setDescription('View all your placed bets which are yet to be claimed.')
        .addUserOption(option => option.setName(`user`).setDescription(`Only use this if you want to see someone else's bets.`).setRequired(false)),
    
	async execute(variables) {
		let { interaction, con, ad } = variables;

        let user = interaction.options.getUser(`user`);

        let ID;
        if (!user) ID = interaction.user.id;
        else ID = user.id; 

        let userObject = await query(con, `SELECT * FROM users WHERE ID = "${ID}";`);
        userObject = userObject[0];

        let bets = await query(con, `SELECT * FROM bets WHERE ID = "${ID}";`);
        let betsValid = true;
        if (!bets) betsValid = false;
        else if (bets.length == 0) betsValid = false;
        
        bets = bets[0];

        let embed = new Discord.MessageEmbed()
            .setTitle(`Bets placed for user ${((user) ? `${user.username}#${user.discriminator}` : interaction.user.tag)}:`)
            .setDescription(`Your remaining balance is \`$${userObject.Balance.toFixed(2)}\`.`)
            .setFooter({ text: `Note: NBABot's simulated betting system uses NO real money/currency.` })
            .setColor(teamColors.NBA);

        let fields = 0;
        for (var key in bets) {
            if (key == `ID`) continue;
            if (!bets[key]) continue;
            
            let date = key.split(`d`).join(``);
            let date2 = `${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}`;
            date = new Date(date.substring(0, 4), parseInt(date.substring(4, 6)) - 1, date.substring(6, 8));

            let str1 = `__${date.toDateString()} (${date2}):__`;
            let str2 = ``;

            // e.g. OKC|10|29.30

            let totalPlaced = 0, totalPayout = 0;
            for (var i = 0; i < bets[key].split(`,`).length; i++) {
                let details = bets[key].split(`,`)[i].split(`|`);
                str2 += `\`$${parseFloat(details[1]).toFixed(2)}\` on ${teamEmojis[details[0]]} (payout: \`$${parseFloat(details[2]).toFixed(2)}\`)\n`;
                totalPlaced += parseFloat(details[1]);
                totalPayout += parseFloat(details[2]);
            }
            
            if (bets[key].split(`,`).length > 1) {
                str2 += `Total placed: \`$${totalPlaced.toFixed(2)}\`, Total payout: \`$${totalPayout.toFixed(2)}\`.`
            }

            fields++;
            embed.addField(str1, str2);
        }

        if (fields == 0) return await interaction.reply({ content: `You have no bets placed.` });

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.reply({ embeds: [embed] });
	},
};
