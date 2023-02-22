// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fs = require(`fs`);

// Assets
const generalEmojis = require(`../assets/emojis.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const formatTeam = require(`../methods/format-team.js`);
const formatDate = require(`../methods/format-date.js`);
const getJSON = require(`../methods/get-json.js`);
const getUser = require(`../methods/database/get-user.js`);
const updateUser = require(`../methods/database/update-user.js`);
const query = require(`../methods/database/query.js`);
const formatDuration = require(`../methods/format-duration.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bet')
		.setDescription('Bet on a certain team to win')
        .addStringOption(option => option.setName(`team`).setDescription(`e.g. PHX or Lakers. Use /teams for more info.`).setRequired(true))
        .addStringOption(option => option.setName(`amount`).setDescription(`e.g. $5.50 or $10`).setRequired(true))
        .addStringOption(option => option.setName(`date`).setDescription(`today/tomorrow/yesterday or a date in mm/dd/yyyy format.`)),
    
	async execute(variables) {
		let { interaction, con, ad } = variables;

        await require(`../methods/update-peak-positions.js`)(con, interaction.user.id);

        // Interaction options
        let requestedTeam = interaction.options.getString(`team`),
            requestedAmount = interaction.options.getString(`amount`),
            requestedDate = interaction.options.getString(`date`);
        let team, teamLocation, amount, date, gameName, payout;

        // If team wrong, trying switching around amount and team and seeing if that works
        if (!formatTeam(requestedTeam) && formatTeam(requestedAmount)) {
            let a = [requestedTeam, requestedAmount];
            requestedTeam = a[1];
            requestedAmount = a[0];
        }

        // Getting user data
        let user = await getUser(con, `users`, interaction.user.id);
        user = user[0];

        // Validating the team
        team = formatTeam(requestedTeam);
        if (!team) return await interaction.reply({ content: `Please use a valid team. Use /teams to find out more info.` });

        // Validating the amount
        if (requestedAmount.toLowerCase() == `all`) requestedAmount = parseFloat(user.Balance);
        else if (requestedAmount[0] == `$`) requestedAmount = requestedAmount.substring(1, requestedAmount.length);
        if (!parseFloat(requestedAmount)) return await interaction.reply({ content: `Please use a valid amount, e.g. $5.50 or $10.` });
        amount = parseFloat(parseFloat(requestedAmount).toFixed(2));

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

        // Seeing if cache can be used
        async function checkForGame(date, first = true) {
            let json;
            if (today && first) {
                json = require(`../cache/${currentDate}/scoreboard.json`);
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

            // Seeing if the game has started
            for (var i = 0; i < json.games.length; i++) {
                let c = json.games[i];
                if (team == c.awayTeam.teamTricode) {
                    if (c.gameStatus != 1 && interaction.user.id != `401649168948396032`) return await interaction.reply({ content: `The game \`${c.awayTeam.teamTricode} @ ${c.homeTeam.teamTricode}\` on \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\` has already started so you cannot bet on it.` });
                    teamLocation = `awayTeam`;
                    gameName = `${c.awayTeam.teamTricode} @ ${c.homeTeam.teamTricode}`;
                } else if (team == c.homeTeam.teamTricode) {
                    if (c.gameStatus != 1 && interaction.user.id != `401649168948396032`) return await interaction.reply({ content: `The game \`${c.awayTeam.teamTricode} @ ${c.homeTeam.teamTricode}\` on \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\` has already started so you cannot bet on it.` });
                    teamLocation = `homeTeam`;
                    gameName = `${c.awayTeam.teamTricode} @ ${c.homeTeam.teamTricode}`;
                }
            }
        }

        await checkForGame(date);

        if (!teamLocation) {
            // Checking games after original date (could be tomorrow but no games on that date or date not rolled over yet)
            let dateT = new Date(new Date(date.substring(0, 4), parseInt(date.substring(4, 6)) - 1, date.substring(6, 8)).getTime() + 1000 * 60 * 60 * 24).toISOString().substring(0, 10).split(`-`).join(``);
            await checkForGame(dateT, false);
            if (!teamLocation) {
                return await interaction.reply({ content: `\`${team}\` did not play on \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\`.` });
            } else {
                date = dateT;
            }
        }

        // Seeing if odds are available
        let odds, teams;
        if (fs.existsSync(`./cache/${date}/`)) {
            if (fs.existsSync(`./cache/${date}/odds.json`)) {
                odds = require(`../cache/${date}/odds.json`);
                for (var name in odds) {
                    if (name.split(` @ `).includes(team)) {
                        odds = odds[name];
                        teams = name.split(` @ `);
                    }
                }
            }
        }
        if (!odds) return await interaction.reply({ content: `Odds are not available for \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\`.` });
        if (!odds.awayTeamOdds || !odds.homeTeamOdds) return await interaction.reply({ content: `The odds for \`${gameName}\` on \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\` are not available.` });
        if (!odds.awayTeamOdds.moneyLine || !odds.homeTeamOdds.moneyLine) return await interaction.reply({ content: `The odds for \`${gameName}\` on \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\` are not available.` });

        if (user.Balance < amount) return await interaction.reply({ content: `Your balance of \`$${user.Balance.toFixed(2)}\` is not enough to make a bet of \`$${amount.toFixed(2)}\`.`});

        // Calculating payout
        odds = parseInt(odds[`${teamLocation}Odds`].moneyLine);
        if (odds > 0) { // Positive odds
            payout = parseFloat(amount + amount * (odds / 100));
        } else if (odds < 0) { // Negative odds
            payout = parseFloat(amount + amount * (100 / -odds));
        }
        payout = payout.toFixed(2);

        if (payout == amount.toFixed(2)) return await interaction.reply(`You cannot place any bets with no potential gain.`);

        // Checking if the date is a column in bets, if not create
        let betsFromDate;
        try {
            betsFromDate = await query(con, `SELECT d${date} FROM bets;`);
        } catch (e) {
            try {
                await query(con, `ALTER TABLE bets ADD d${date} varchar(512);`);
            } catch (e) {
                return await interaction.reply(`An error occurred with code 3. Please contact chig#4519 if this issue persists.`);
            }  
        }
        if (!betsFromDate) {
            try {
                await query(con, `ALTER TABLE bets ADD d${date} varchar(512);`);
            } catch (e) {
                return await interaction.reply(`An error occurred with code 3. Please contact chig#4519 if this issue persists.`);
            }
        }

        let existingBetsFromDate = await query(con, `SELECT d${date} FROM bets WHERE ID = "${interaction.user.id}";`);
        
        let betAlreadyExists = true;
        if (!existingBetsFromDate) betAlreadyExists = false;
        else if (existingBetsFromDate.length == 0) betAlreadyExists = false;
        else if (!existingBetsFromDate[0][`d${date}`]) betAlreadyExists = false;

        let replacedBet;
        if (!betAlreadyExists) {
            await query(con, `UPDATE bets SET d${date} = "${team}|${amount}|${payout}" WHERE ID = "${interaction.user.id}";`);
        } else {
            existingBetsFromDate = existingBetsFromDate[0][`d${date}`];
            existingBetsFromDate = existingBetsFromDate.split(`,`);

            // Checking if there's already a bet on that game and remove it + refund bet
            for (var i = 0; i < existingBetsFromDate.length; i++) {
                if (existingBetsFromDate[i].split(`|`).includes(teams[0]) || existingBetsFromDate[i].split(`|`).includes(teams[1])) {
                    replacedBet = existingBetsFromDate[i].split(`|`);
                    user.Balance += parseFloat(existingBetsFromDate[i].split(`|`)[1]);
                    existingBetsFromDate.splice(i, 1);
                }
            }

            existingBetsFromDate.push(`${team}|${amount}|${payout}`);
            existingBetsFromDate.join(`,`);
            await query(con, `UPDATE bets SET d${date} = "${existingBetsFromDate}" WHERE ID = "${interaction.user.id}";`);
        }

        // Subtracting from user balance
        user.Balance -= amount;
        user.Balance = parseFloat(user.Balance.toFixed(2));
        await updateUser(con, `users`, interaction.user.id, user);

        // Final message
        let embed = new Discord.MessageEmbed()
            .setTitle(`${generalEmojis.success} Bet successfully placed.`)
            .setColor(0x5CB85C)
            .setDescription(`Your balance is now \`$${user.Balance.toFixed(2)}\`.`)
            .addField(`Details:`, `**Game:** ${teams.join(` @ `)} on ${new Date(date.substring(0, 4), parseInt(date.substring(4, 6)) - 1, parseInt(date.substring(6, 8))).toDateString()}\n**Team**: ${team}\n**Amount placed**: $${parseFloat(amount).toFixed(2)}\n**Possible payout**: $${parseFloat(payout).toFixed(2)}`);

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });
        if (replacedBet) embed.setFooter({ text: `Note: Your previous bet of $${replacedBet[1]} on ${replacedBet[0]} was automatically replaced.` });

        // Getting all current bets and DMing user with it
        let bets = await query(con, `SELECT * FROM bets WHERE ID = "${interaction.user.id}";`);
        let betsValid = true;
        if (!bets) betsValid = false;
        else if (bets.length == 0) betsValid = false;
        
        bets = bets[0];

        let embed2 = new Discord.MessageEmbed()
            .setTitle(`Bets placed for user ${interaction.user.tag}:`)
            .setDescription(`Your remaining balance is \`$${user.Balance.toFixed(2)}\`.`)
            .setFooter({ text: `Note: NBABot's simulated betting system uses no real money/currency.` })
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
            embed2.addField(str1, str2);

            if (str3) embed2.addField(`...`, str3);
        }

        try {
            await interaction.user.send({ embeds: [embed2] });
        } catch (e) {
            embed.addField(`Note: NBABot could not DM you all your current bets. Use \`/bets\` for this.`, `To allow NBABot to DM you once your bets are claimed,\nGo to Settings > Privacy & Safety > Allow direct messages from server members.`);
        }

        return await interaction.reply({ embeds: [embed] });
	},
};
