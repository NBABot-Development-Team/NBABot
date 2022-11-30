// Libraries
const { SlashCommandBuilder } = require(`@discordjs/builders`);
const Discord = require(`discord.js`);
const fs = require(`fs`);

// Assets
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const query = require(`../methods/database/query.js`);
const formatDate = require(`../methods/format-date.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`parlay`)
		.setDescription(`Bet on the outcomes of multiple games and get combined odds if the bets are all correct`)
        .addStringOption(option => option.setName(`amount`).setDescription(`The amount you want to place on this parlay, e.g. $3.20 or 98.00`).setRequired(true))
        .addStringOption(option => option.setName(`date`).setDescription(`If you want to make a parlay on a future date, enter it here.`)),
    
	async execute(variables) {
		let { interaction, con } = variables;

        await interaction.deferReply();

		let requestedAmount = interaction.options.getString(`amount`), amount;
            requestedDate = interaction.options.getString(`date`);

        let date;
            
        let totalPayout = 0.00, totalOdds = 1.00, oddsChosen = {}, gameDetails = {};

        // Getting user information
        let user = await query(con, `SELECT * FROM users WHERE ID = "${interaction.user.id}";`);
        user = user[0];

        // Validating the amount
        if (requestedAmount.toLowerCase() == `all`) requestedAmount = parseFloat(user.Balance);
        else if (requestedAmount[0] == `$`) requestedAmount = requestedAmount.substring(1, requestedAmount.length);
        if (!parseFloat(requestedAmount)) return await interaction.editReply({ content: `Please use a valid amount, e.g. $5.50 or $10.` });
        amount = parseFloat(parseFloat(requestedAmount).toFixed(2));
        if (amount == 0) return await interaction.editReply(`Your betted amount must be more than \`$0.00\`.`);

        // Seeing if they can actually place that amount
        if (amount > user.Balance) return await interaction.editReply(`Insufficient balance.\nAttempted parlay: \`$${amount.toFixed(2)}\`\nBalance: \`$${user.Balance.toFixed(2)}\``);
        
        // Validating the date
        delete require.cache[require.resolve(`../cache/today.json`)];
        let currentDate = require(`../cache/today.json`).links.currentDate;
        let today = false;
        if (!requestedDate) {
            date = currentDate;
            today = true;
        } else {
            date = await formatDate(requestedDate, con, interaction.user.id);
            if (!date) return await interaction.reply({ content: `Please use a valid date in mm/dd/yyyy format.` });
        }

        // Getting odds
        let odds;
        if (fs.existsSync(`./cache/${date}/odds.json`)) {
            try {
                odds = require(`../cache/${date}/odds.json`);
            } catch (e) {
                return await interaction.editReply(`Odds are not available for \`${new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`).toDateString()}\`.`);
            }
        } else return await interaction.editReply(`Odds are not available for \`${new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`).toDateString()}\`.`);
        if (!odds) return await interaction.editReply(`Odds are not available for \`${new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`).toDateString()}\`.`);
        
        // Getting scoreboard
        let games;
        if (fs.existsSync(`./cache/${date}/scoreboard.json`)) {
            try {
                games = require(`../cache/${date}/scoreboard.json`).games;
            } catch (e) {
                return await interaction.editReply(`Scores are not available for \`${new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`).toDateString()}\`.`);
            }
        } else return await interaction.editReply(`Scores are not available for \`${new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`).toDateString()}\`.`);
        if (!games) return await interaction.editReply(`Scores are not available for \`${new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`).toDateString()}\`.`);
        if (games.length == 0) return await interaction.editReply(`There are no games on \`${new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`).toDateString()}\`.`);

        // Finding games that have not started and odds are available
        let gamesAvailable = [];
        gameLoop: for (var i = 0; i < games.length; i++) {
            if (games[i].gameStatus > 1 && interaction.user.id != `401649168948396032`) continue gameLoop;
            if (!odds[`${games[i].awayTeam.teamTricode} @ ${games[i].homeTeam.teamTricode}`]) continue gameLoop;

            let o = odds[`${games[i].awayTeam.teamTricode} @ ${games[i].homeTeam.teamTricode}`];

            // Converting odds to decimal for calculations
            let vTeamPayout = (((o.awayTeamOdds.moneyLine > 0) ? parseInt(100 + o.awayTeamOdds.moneyLine) : parseInt(100 + (10000/-o.awayTeamOdds.moneyLine))) / 100).toPrecision(3);
            let hTeamPayout = (((o.homeTeamOdds.moneyLine > 0) ? parseInt(100 + o.homeTeamOdds.moneyLine) : parseInt(100 + (10000/-o.homeTeamOdds.moneyLine))) / 100).toPrecision(3);

            gamesAvailable.push({
                homeTeam: {
                    teamTricode: games[i].homeTeam.teamTricode,
                    payout: vTeamPayout
                },
                awayTeam: {
                    teamTricode: games[i].awayTeam.teamTricode,
                    payout: hTeamPayout
                }
            });
        }
        if (gamesAvailable.length == 0) return await interaction.editReply(`Odds are not available for \`${new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`).toDateString()}\`.`);

        async function sendParlayEmbed(update, currentInteraction, i) {
            // Give them first game to bet on
            let embed = new Discord.MessageEmbed()
                .setTitle(`__Your current parlay:__`)
                .addField(`Overall parlay details`, `Amount placed: \`$${amount.toFixed(2)}\`\nPossible payout: \`$${(amount * totalOdds).toFixed(2)}\`\nOverall odds: \`$1 -> $${totalOdds.toFixed(2)}\``)
                .setColor(teamColors.NBA);

            // Putting chosenTeam if there are some chosen
            if (Object.keys(oddsChosen).length > 0) {
                let str1 = `Teams already chosen`, str2 = ``;
                for (var team in gameDetails) {
                    str2 += `${gameDetails[team].str}\n`;
                }
                embed.addField(str1, str2);
            }

            embed.addField(`${teamEmojis[gamesAvailable[i].awayTeam.teamTricode]} ${gamesAvailable[i].awayTeam.teamTricode} @ ${gamesAvailable[i].homeTeam.teamTricode} ${teamEmojis[gamesAvailable[i].homeTeam.teamTricode]}`, `${gamesAvailable[i].awayTeam.teamTricode}: \`$1 -> $${gamesAvailable[i].awayTeam.payout}\`\n${gamesAvailable[i].homeTeam.teamTricode}: \`$1 -> $${gamesAvailable[i].homeTeam.payout}\``);

            let row = new Discord.MessageActionRow()
                .addComponents(
                    new Discord.MessageButton()
                        .setCustomId(`parlay-${date}-move-${i - 1}`)
                        .setLabel(`←`)
                        .setStyle(`SECONDARY`)
                        .setDisabled(!gamesAvailable[i - 1]),

                    new Discord.MessageButton()
                        .setCustomId(`parlay-${date}-select-${gamesAvailable[i].awayTeam.teamTricode}-${i}`)
                        // .setLabel(gamesAvailable[i].awayTeam.teamTricode)
                        .setEmoji(teamEmojis[gamesAvailable[i].awayTeam.teamTricode])
                        .setStyle(`PRIMARY`),

                    new Discord.MessageButton()
                        .setCustomId(`parlay-${date}-select-${gamesAvailable[i].homeTeam.teamTricode}-${i}`)
                        // .setLabel(gamesAvailable[i].homeTeam.teamTricode)
                        .setEmoji(teamEmojis[gamesAvailable[i].homeTeam.teamTricode])
                        .setStyle(`PRIMARY`),

                    new Discord.MessageButton()
                        .setCustomId(`parlay-${date}-move-${i + 1}`)
                        .setLabel(`→`)
                        .setStyle(`SECONDARY`)
                        .setDisabled(!gamesAvailable[i + 1])
                );
            
            let row2 = new Discord.MessageActionRow()
                .addComponents(
                    new Discord.MessageButton()
                        .setCustomId(`parlay-${date}-cancel`)
                        .setLabel(`Cancel`)
                        .setStyle(`DANGER`),
                    
                    new Discord.MessageButton()
                        .setCustomId(`parlay-${date}-done`)
                        .setLabel(`Done`)
                        .setStyle(`SUCCESS`)
                        .setDisabled(Object.keys(oddsChosen).length < 2)
                );

            if (update) {
                await currentInteraction.update({ embeds: [embed], components: [row, row2] });
            } else {
                await currentInteraction.editReply({ embeds: [embed], components: [row, row2] });
            }
        }

        // Initial call
        sendParlayEmbed(false, interaction, 0);

        // Getting button responses
        const filter = i => i.customId.split(`-`)[0] == `parlay` && i.user.id == interaction.user.id && i.customId.split(`-`)[1] == date;
        const collector = interaction.channel.createMessageComponentCollector({ filter });

        collector.on(`collect`, async i => { 
            collector.resetTimer();
            await require(`../methods/add-to-button-count.js`)(con);
            let action = i.customId.split(`-`)[2], count;

            switch (action) {
                case `move`:
                    count = parseInt(i.customId.split(`-`)[3]);
                    sendParlayEmbed(true, i, count);
                    break;

                case `select`:
                    // Action is selecting a team
                    count = parseInt(i.customId.split(`-`)[4]);
                    let foundTeam, location, team = i.customId.split(`-`)[3];
                    game: for (var j = 0; j < gamesAvailable.length; j++) {
                        if (gamesAvailable[j].awayTeam.teamTricode == team) {
                            // Selected team is awayTeam
                            foundTeam = gamesAvailable[j];
                            location = `awayTeam`;
                            otherTeam = foundTeam.homeTeam.teamTricode;
                            break game;
                        } else if (gamesAvailable[j].homeTeam.teamTricode == team) {
                            // Selected team is homeTeam
                            foundTeam = gamesAvailable[j];
                            location = `homeTeam`;
                            otherTeam = foundTeam.awayTeam.teamTricode;
                            break game;
                        }
                    }
                    if (!foundTeam || !location) {
                        collector.stop();
                        return await i.update(`An error occurred finding that game's details. The parlay has not been placed.`);
                    }

                    // Checking if the other or same team has already been selected
                    if (oddsChosen[team]) {
                        totalOdds = (totalOdds / oddsChosen[team]).toFixed(2);

                        delete oddsChosen[team];
                        delete gameDetails[team];
                    } else if (oddsChosen[otherTeam]) {
                        totalOdds = (totalOdds / oddsChosen[otherTeam]).toFixed(2);

                        delete oddsChosen[otherTeam];
                        delete gameDetails[otherTeam];
                    }

                    oddsChosen[team] = foundTeam[location].payout;
                    gameDetails[team] = {
                        str: (location == `awayTeam`) ? `__${foundTeam.awayTeam.teamTricode}__ @ ${foundTeam.homeTeam.teamTricode}` : `${foundTeam.awayTeam.teamTricode} @ __${foundTeam.homeTeam.teamTricode}__`
                    };
                    totalOdds = totalOdds * oddsChosen[team];

                    sendParlayEmbed(true, i, count);
                    break;

                case `cancel`:
                    totalPayout = 0.00;
                    totalOdds = 1.00;
                    oddsChosen = {};
                    gameDetails = {};
                    collector.stop();
                    return await i.update({ embeds: [], components: [], content: `Your parlay has been cancelled.`});
                    break;

                case `done`:
                    // Seeing if they've actually done 2+ bets in the parlay
                    if (Object.keys(oddsChosen).length == 0) {
                        collector.stop();
                        return await i.update({ embeds: [], components: [], content: `Please select at least 2 teams to form the parlay. Try again with \`/parlay\`.` });
                    }
                    else if (Object.keys(oddsChosen).length == 1) {
                        collector.stop();
                        return await i.update({ embeds: [], components: [], content: `Please select at least 2 teams to form the parlay. If you want to be on just 1 team, use \`/bet\`.` });
                    }

                    // Checking if their balance is enough again
                    user = await query(con, `SELECT * FROM users WHERE ID = "${i.user.id}";`);
                    user = user[0];
                    if (user.Balance < amount) {
                        collector.stop();
                        return await i.update({ embeds: [], components: [], content: `Your balance of \`$${user.Balance.toFixed(2)}\` is not enough to place a parlay of \`$${amount.toFixed(2)}\`.`});
                    }

                    totalPayout = (amount * totalOdds).toFixed(2);
                    let betStr = `${Object.keys(oddsChosen).join(`+`)}|${amount.toFixed(2)}|${totalPayout}`;

                    // Getting bets from that date
                    let betsAll = await query(con, `SELECT d${date} FROM bets WHERE ID = "${i.user.id}";`);
                    let bets = betsAll?.[0]?.[`d${date}`];
                    if (!bets) bets = betStr;
                    else {
                        bets = bets.split(`,`);

                        // Checking if already a parlay there
                        for (var j = 0; j < bets.length; j++) {
                            if (bets[j].includes(`+`)) {
                                collector.stop();
                                return await i.update({ embeds: [], components: [], content: `You already have a parlay placed for \`${new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`).toDateString()}\`. Retract it with \`/rbet parlay\` then place this parlay again.` });
                            }
                        }

                        bets.push(betStr);
                        bets.join(`,`);
                    }
                    user.Balance -= amount;
                    await query(con, `UPDATE users SET Balance = ${user.Balance.toFixed(2)} WHERE ID = "${i.user.id}";`);
                    await query(con, `UPDATE bets SET d${date} = "${bets}" WHERE ID = "${i.user.id}";`);

                    let embed = new Discord.MessageEmbed()
                        .setTitle(`__Parlay successfully placed:__`)
                        .setColor(0x5CB85C)
                        .setDescription(`Amount placed: \`$${amount.toFixed(2)}\`\nPossible payout: \`$${totalPayout}\`\nTotal odds: \`$1 -> $${totalOdds.toFixed(2)}\`\nTeams: ${Object.keys(oddsChosen).join(`, `)}\nYour remaining balance: \`$${user.Balance.toFixed(2)}\``);

                    totalPayout = 0.00, totalOdds = 1.00, oddsChosen = {}, gameDetails = {};
                    collector.stop();
                    return await i.update({ embeds: [embed], components: [] });
                    break;
            }
        });
	},
};
