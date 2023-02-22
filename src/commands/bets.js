// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);

// Methods
const formatDuration = require(`../methods/format-duration.js`);

// Methods
const query = require('../methods/database/query');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bets')
		.setDescription('View all your placed bets which are yet to be claimed.')
        .addUserOption(option => option.setName(`user`).setDescription(`Only use this if you want to see someone else's bets.`).setRequired(false)),
    
	async execute(variables) {
		let { interaction, con, ad } = variables;

        await require(`../methods/update-peak-positions.js`)(con, interaction.user.id);

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
            let str2 = ``, str3 = ``;

            // e.g. OKC|10|29.30

            let scoreboard;
            try {
                scoreboard = require(`../cache/${key.split(`d`).join(``)}/scoreboard.json`);
            } catch (e) {
                scoreboard = null;
            }

            let totalPlaced = 0, totalPayout = 0;
            for (var i = 0; i < bets[key].split(`,`).length; i++) {
                let details = bets[key].split(`,`)[i].split(`|`);

                // Trying to find opponent details
                let opponent, startStr;
                if (scoreboard) {
                    gameLoop: for (var j = 0; j < scoreboard.games.length; j++) {
                        if (scoreboard.games[j].awayTeam.teamTricode == details[0]) {
                            opponent = ` @ ${teamEmojis[scoreboard.games[j].homeTeam.teamTricode]}`;
                            if (scoreboard.games[j].gameStatus == 1) {
                                if (scoreboard.games[j].gameDateTimeUTC) {
                                    startStr = ` Starts ${formatDuration(new Date(scoreboard.games[j].gameDateTimeUTC).getTime())}`;
                                } else if (scoreboard.games[j].gameTimeUTC) {
                                    startStr = ` Starts ${formatDuration(new Date(scoreboard.games[j].gameTimeUTC).getTime())}`;
                                }
                            } else startStr = ` Game has started`;
                            break gameLoop;
                        } else if (scoreboard.games[j].homeTeam.teamTricode == details[0]) {
                            opponent = ` v ${teamEmojis[scoreboard.games[j].awayTeam.teamTricode]}`;
                            if (scoreboard.games[j].gameStatus == 1) {
                                if (scoreboard.games[j].gameDateTimeUTC) {
                                    startStr = ` Starts ${formatDuration(new Date(scoreboard.games[j].gameDateTimeUTC).getTime())}`;
                                } else if (scoreboard.games[j].gameTimeUTC) {
                                    startStr = ` Starts ${formatDuration(new Date(scoreboard.games[j].gameTimeUTC).getTime())}`;
                                }
                            } else startStr = ` Game has started`;
                            break gameLoop;
                        }
                    }
                }

                let whoStr = ``;
                if (details[0].includes(`+`)) {
                    for (var p = 0; p < details[0].split(`+`).length; p++) {
                        whoStr += teamEmojis[details[0].split(`+`)[p]];
                        if (p < details[0].split(`+`).length - 1) whoStr += `, `;
                    }
                } else whoStr = teamEmojis[details[0]];

                let temp = str2;
                let addStr = `\`$${parseFloat(details[1]).toFixed(2)}\` on ${whoStr}${(opponent && !details[0].includes(`+`)) ? opponent : ``} (payout: \`$${parseFloat(details[2]).toFixed(2)}\`)${(startStr) ? ` |${startStr}` : ``}\n`;
                if ((temp += addStr).length >= 1024) {
                    str3 += addStr;
                } else str2 += addStr;
                
                totalPlaced += parseFloat(details[1]);
                totalPayout += parseFloat(details[2]);
            }
            
            if (bets[key].split(`,`).length > 1) {
                let temp = str2;
                let addStr = `\nTotal placed: \`$${totalPlaced.toFixed(2)}\`, Total payout: \`$${totalPayout.toFixed(2)}\`.`;
                if ((temp += addStr).length >= 1024) {
                    str3 += addStr;
                } else str2 += addStr;
            }

            fields++;
            embed.addField(str1, str2);

            if (str3) embed.addField(`...`, str3);
        }

        if (fields == 0) return await interaction.reply({ content: `You have no bets placed.` });

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.reply({ embeds: [embed] });
	},
};
