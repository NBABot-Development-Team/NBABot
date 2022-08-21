// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fs = require(`fs`);

// Methods
const formatDate = require(`../methods/format-date.js`);
const getJSON = require(`../methods/get-json.js`);
const query = require(`../methods/database/query.js`);

// JSON files
const teamEmojis = require(`../assets/teams/emojis.json`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`odds`)
		.setDescription(`Get odds for NBA games for the simulated betting system.`)
        .addStringOption(option => option.setName(`date`).setDescription(`Tomorrow/yesterday/tomorrow or a date in mm/dd/yyyy format.`)),
    
	async execute(variables) {
		let { con, interaction } = variables;

        // Getting currentDate
        delete require.cache[require.resolve(`../cache/today.json`)];
        let currentDate = require(`../cache/today.json`).links.currentDate;

        let requestedDate = interaction.options.getString(`date`);

        // Checking that the date is valid
        let today = false;
        if (!requestedDate) {
            requestedDate = currentDate;
            today = true;
        } else {
            requestedDate = await formatDate(con, interaction.user.id, requestedDate);
            if (requestedDate == currentDate) today = true;
            if (!requestedDate) {
                return await interaction.reply({ content: `Please use today/tomorrow/yesterday or a valid date in mm/dd/yyyy format, e.g. 12/25/2020.` });
            }
        }
        let dateObject = new Date(requestedDate.substring(0, 4), parseInt(requestedDate.substring(4, 6)) - 1, requestedDate.substring(6, 8));

        // Checking if odds are available
        let odds;
        if (fs.existsSync(`./cache/${requestedDate}/`)) {
            if (fs.existsSync(`./cache/${requestedDate}/odds.json`)) {
                delete require.cache[require.resolve(`../cache/${requestedDate}/odds.json`)];
                odds = require(`../cache/${requestedDate}/odds.json`);
            }
        }
        if (!odds) return await interaction.reply({ content: `Odds are not available for \`${dateObject.toDateString()}\`.` });
        if (Object.keys(odds) == 0) return await interaction.reply({ content: `Odds are not available for \`${dateObject.toDateString()}\`.` });

        // Getting the date's scoreboard
        let json;
        if (today) json = require(`../cache/${requestedDate}/scoreboard.json`);
        else json = await getJSON(`http://data.nba.net/10s/prod/v1/${requestedDate}/scoreboard.json`);  
        
        let embed = new Discord.MessageEmbed()
            .setTitle(`Odds for ${dateObject.toDateString()}`)
            .setColor(0xff4242)
            .setDescription(`To place a bet, use \`/bet\`.\nMake sure to claim the bet after the game has finished with \`/claim\`.`);

        // Getting odds type
        let oddsType = await query(con, `SELECT * FROM users WHERE ID = '${interaction.user.id}';`);
        oddsType = oddsType[0].Odds;

        oddsLoop: for (var name in odds) {
            let teams = name.split(` @ `);
            
            gameLoop: for (var i = 0; i < json.games.length; i++) {
                let c = json.games[i];
                if (teams.includes(c.vTeam.triCode) && teams.includes(c.hTeam.triCode)) {
                    // Found the game
                    if (c.statusNum > 1) {
                        embed.addField(`${teamEmojis[c.vTeam.triCode]} ${c.vTeam.triCode} @ ${c.hTeam.triCode} ${teamEmojis[c.hTeam.triCode]} | ${c.startTimeEastern}`, `Game has already started.`);
                        continue oddsLoop;
                    }

                    let o = odds[name];

                    if (!o.homeTeamOdds || !o.awayTeamOdds) {
                        embed.addField(`${teamEmojis[c.vTeam.triCode]} ${c.vTeam.triCode} @ ${c.hTeam.triCode} ${teamEmojis[c.hTeam.triCode]} | ${c.startTimeEastern}`, `Odds are not available.`);
                        continue oddsLoop;
                    }

                    if (!o.homeTeamOdds.moneyLine || !o.awayTeamOdds.moneyLine) {
                        embed.addField(`${teamEmojis[c.vTeam.triCode]} ${c.vTeam.triCode} @ ${c.hTeam.triCode} ${teamEmojis[c.hTeam.triCode]} | ${c.startTimeEastern}`, `Odds are not available.`);
                        continue oddsLoop;
                    }

                    let vTeamPayout = (((o.awayTeamOdds.moneyLine > 0) ? parseInt(100 + o.awayTeamOdds.moneyLine) : parseInt(100 + (10000/-o.awayTeamOdds.moneyLine))) / 100).toPrecision(3);
                    let hTeamPayout = (((o.homeTeamOdds.moneyLine > 0) ? parseInt(100 + o.homeTeamOdds.moneyLine) : parseInt(100 + (10000/-o.homeTeamOdds.moneyLine))) / 100).toPrecision(3);

                    if (!vTeamPayout || !hTeamPayout) {
                        embed.addField(`${teamEmojis[c.vTeam.triCode]} ${c.vTeam.triCode} @ ${c.hTeam.triCode} ${teamEmojis[c.hTeam.triCode]} | ${c.startTimeEastern}`, `Odds are not available.`);
                        continue oddsLoop;
                    }

                    if (oddsType == `d`) {
                        embed.addField(`${teamEmojis[c.vTeam.triCode]} ${c.vTeam.triCode} @ ${c.hTeam.triCode} ${teamEmojis[c.hTeam.triCode]} | ${c.startTimeEastern}`, `**${c.vTeam.triCode}**: \`$1 -> $${vTeamPayout}\`\n**${c.hTeam.triCode}**: \`$1 -> $${hTeamPayout}\``);
                    } else {
                        embed.addField(`${teamEmojis[c.vTeam.triCode]} ${c.vTeam.triCode} @ ${c.hTeam.triCode} ${teamEmojis[c.hTeam.triCode]} | ${c.startTimeEastern}`, `**${c.vTeam.triCode}**: \`${(o.awayTeamOdds.moneyLine > 0) ? `+${o.awayTeamOdds.moneyLine}` : o.awayTeamOdds.moneyLine}\`\n**${c.hTeam.triCode}**: \`${(o.homeTeamOdds.moneyLine > 0) ? `+${o.homeTeamOdds.moneyLine}` : o.homeTeamOdds.moneyLine}\``);
                    }
                    continue oddsLoop;
                }
            }
        }

        return await interaction.reply({ embeds: [embed] });
	},
};
