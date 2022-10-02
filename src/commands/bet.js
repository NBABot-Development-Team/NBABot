// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fs = require(`fs`);

// Assets
const generalEmojis = require(`../assets/emojis.json`);

// Methods
const formatTeam = require(`../methods/format-team.js`);
const formatDate = require(`../methods/format-date.js`);
const getJSON = require(`../methods/get-json.js`);
const getUser = require(`../methods/database/get-user.js`);
const updateUser = require(`../methods/database/update-user.js`);
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bet')
		.setDescription('Bet on a certain team to win')
        .addStringOption(option => option.setName(`team`).setDescription(`e.g. PHX or Lakers. Use /teams for more info.`).setRequired(true))
        .addStringOption(option => option.setName(`amount`).setDescription(`e.g. $5.50 or $10`).setRequired(true))
        .addStringOption(option => option.setName(`date`).setDescription(`today/tomorrow/yesterday or a date in mm/dd/yyyy format.`)),
    
	async execute(variables) {
		let { interaction, con, ad } = variables;

        // Interaction options
        let requestedTeam = interaction.options.getString(`team`),
            requestedAmount = interaction.options.getString(`amount`),
            requestedDate = interaction.options.getString(`date`);
        let team, teamLocation, amount, date, gameName, payout;

        // Getting user data
        let user = await getUser(con, `users`, interaction.user.id);
        user = user[0];

        // Validating the team
        team = formatTeam(requestedTeam);
        if (!team) return await interaction.reply({ content: `Please use a valid team. Use /teams to find out more info.` });

        // Validating the amount
        console.log(typeof parseFloat(user.Balance));
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
        let json;
        if (today) {
            json = require(`../cache/${currentDate}/scoreboard.json`);
        } else json = await getJSON(`http://data.nba.net/10s/prod/v1/${date}/scoreboard.json`);

        // Seeing if the game has started
        for (var i = 0; i < json.games.length; i++) {
            let c = json.games[i];
            if (team == c.vTeam.triCode) {
                if (c.statusNum != 1 && interaction.user.id != `401649168948396032`) return await interaction.reply({ content: `The game \`${c.vTeam.triCode} @ ${c.hTeam.triCode}\` on \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\` has already started so you cannot bet on it.` });
                teamLocation = `awayTeam`;
                gameName = `${c.vTeam.triCode} @ ${c.hTeam.triCode}`;
            } else if (team == c.hTeam.triCode) {
                if (c.statusNum != 1 && interaction.user.id != `401649168948396032`) return await interaction.reply({ content: `The game \`${c.vTeam.triCode} @ ${c.hTeam.triCode}\` on \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\` has already started so you cannot bet on it.` });
                teamLocation = `homeTeam`;
                gameName = `${c.vTeam.triCode} @ ${c.hTeam.triCode}`;
            }
        }
        if (!teamLocation) return await interaction.reply({ content: `\`${team}\` did not play on \`${date.substring(4, 6)}/${date.substring(6, 8)}/${date.substring(0, 4)}\`.` });

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

        // Checking if the date is a column in bets, if not create
        let betsFromDate;
        try {
            betsFromDate = await query(con, `SELECT d${date} FROM bets;`);
        } catch (e) {
            await query(con, `ALTER TABLE bets ADD d${date} varchar(512);`);
        }
        if (!betsFromDate) await query(con, `ALTER TABLE bets ADD d${date} varchar(512);`);

        let existingBetsFromDate = await query(con, `SELECT d${date} FROM bets WHERE ID = "${interaction.user.id}";`);

        console.log(existingBetsFromDate);
        
        let betAlreadyExists = true;
        if (!existingBetsFromDate) betAlreadyExists = false;
        else if (existingBetsFromDate.length == 0) betAlreadyExists = false;
        else if (!existingBetsFromDate[0][`d${date}`]) betAlreadyExists = false;

        console.log(betAlreadyExists);

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
            .addField(`Details:`, `**Game:** ${teams.join(` @ `)} on ${new Date(date.substring(0, 4), parseInt(date.substring(4, 6)) - 1, parseInt(date.substring(6, 8))).toDateString()}\n**Team**: ${team}\n**Amount placed**: $${amount}\n**Possible payout**: $${payout}`);

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });
        if (replacedBet) embed.setFooter({ text: `Note: Your previous bet of $${replacedBet[1]} on ${replacedBet[0]} was automatically replaced.` });

        return await interaction.reply({ embeds: [embed] });
	},
};
