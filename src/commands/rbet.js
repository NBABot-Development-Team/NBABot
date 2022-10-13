// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Methods
const formatTeam = require(`../methods/format-team.js`);
const formatDate = require(`../methods/format-date.js`);
const query = require(`../methods/database/query.js`);
const getUser = require('../methods/database/get-user.js');
const updateUser = require('../methods/database/update-user.js');
const getJSON = require('../methods/get-json.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rbet')
		.setDescription('Retract a bet you\'ve placed if the game has not yet started.')
        .addStringOption(option => option.setName(`team`).setDescription(`The team which the bet was placed on, e.g. PHX or Lakers.`).setRequired(true))
        .addStringOption(option => option.setName(`date`).setDescription(`Today/tomorrow/yesterday or a date in mm/dd/yyyy format.`)),
    
	async execute(variables) {
		let { interaction, con, ad } = variables;

        let team = interaction.options.getString(`team`), 
            date = interaction.options.getString(`date`);

        // Validating team
        team = formatTeam(team);
        if (!team) return await interaction.reply({ content: `Please use a valid team, e.g. PHX or Lakers. Use /teams for more info.` });

        // Validating date
        delete require.cache[require.resolve(`../cache/today.json`)];
        let currentDate = require(`../cache/today.json`).links.currentDate, today = false;
        if (!date) {
            date = currentDate;
            today = true;
        } else {
            date = await formatDate(date, con, interaction.user.id);
            if (!date) return await interaction.reply({ content: `Please use a valid date in mm/dd/yyyy format.` });
        }

        // Getting scores
        let json;
        if (today) {
            json = require(`../cache/${date}/scoreboard.json`);
        } else {
            json = await getJSON(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`);

            let dates = json.leagueSchedule.gameDates;
            for (var i = 0; i < dates.length; i++) {
                let d = new Date(dates[i].gameDate);
                d = d.toISOString().substring(0, 10).split(`-`).join(``);
                if (d == date) {
                    json = dates[i];
                }
            }
        }

        // Checking that the game hasn't started
        for (var i = 0; i < json.games.length; i++) {
            if ([json.games[i].awayTeam.teamTricode, json.games[i].homeTeam.teamTricode].includes(team)) {
                if (json.games[i].gameStatus > 1) {
                    return await interaction.reply({ content: `The game \`${json.games[i].awayTeam.teamTricode} @ ${json.games[i].homeTeam.teamTricode}\` on \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\` has already started so the bet cannot be retracted.` });
                }
            }
        }

        // Seeing if the user betted on that game
        let bets = await query(con, `SELECT d${date} FROM bets WHERE ID = "${interaction.user.id}";`);
        let betsValid = true;
        if (!bets) betsValid = false;
        else if (bets.length == 0) betsValid = false;

        if (!betsValid) return await interaction.reply({ content: `You did not place any bets on ${new Date(date.substring(0, 4), parseInt(date.substring(4, 6)) - 1, date.substring(6, 8)).toDateString()} (\`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\`).` });
        else {
            bets = bets[0][`d${date}`].split(`,`);
            if (!bets) return await interaction.reply({ content: `No bets from you were found for that date.` });

            let betFound = false;
            for (var i = 0; i < bets.length; i++) {
                if (bets[i].split(`|`)[0] == team) {
                    betFound = true;

                    let user = await getUser(con, `users`, interaction.user.id);
                    user = user[0];
                    user.Balance += parseFloat(bets[i].split(`|`)[1]);
                    await updateUser(con, `users`, interaction.user.id, user);
                    
                    bets.splice(i, 1);
                    await query(con, `UPDATE bets SET d${date} = "${bets.join(`,`)}" WHERE ID = "${interaction.user.id}";`);

                    let embed = new Discord.MessageEmbed()
                        .setTitle(`Bet successfully retracted.`)
                        .setColor(0x5CB85C)
                        .setDescription(`Your balance is now $${user.Balance.toFixed(2)}.`);

                    if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

                    return await interaction.reply({ embeds: [embed] });
                }
            }
        }

        if (!betFound) return await interaction.reply({ content: `You did not bet on \`${team}\` on \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\`. Check \`/bets\` for all your placed bets.` });
	},
};
