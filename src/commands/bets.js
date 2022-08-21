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
		let { interaction, con } = variables;

        let user = interaction.options.getUser(`user`);

        let ID;
        if (!user) ID = interaction.user.id;
        else ID = user.id; 

        let bets = await query(con, `SELECT * FROM bets WHERE ID = "${ID}";`);
        let betsValid = true;
        if (!bets) betsValid = false;
        else if (bets.length == 0) betsValid = false;
        
        bets = bets[0];

        let embed = new Discord.MessageEmbed()
            .setTitle(`Bets placed for user ${((user) ? `${user.username}#${user.discriminator}` : interaction.user.tag)}:`)
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

            for (var i = 0; i < bets[key].split(`,`).length; i++) {
                let details = bets[key].split(`,`)[i].split(`|`);
                str2 += `\`$${parseFloat(details[1]).toFixed(2)}\` on ${teamEmojis[details[0]]} (payout: \`$${parseFloat(details[2]).toFixed(2)}\`)\n`;
            }

            fields++;
            embed.addField(str1, str2);
        }

        if (fields == 0) return await interaction.reply({ content: `You have no bets placed.` });

        return await interaction.reply({ embeds: [embed] });
	},
};
