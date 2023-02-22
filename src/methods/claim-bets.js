// Libraries
const Discord = require(`discord.js`);
const fs = require(`fs`);

// Assets
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const getJSON = require(`./get-json.js`);
const getUser = require(`./database/get-user.js`);
const updateUser = require(`./database/update-user.js`);
const query = require(`./database/query.js`);

module.exports = async (date, userSpecified, teamSpecified) => {
        return new Promise(async resolve => {
            let { con, client } = require(`../bot.js`);

            let betsClaimed = 0;

            delete require.cache[require.resolve(`../cache/today.json`)];
            let currentDate = require(`../cache/today.json`).links.currentDate;

            let json;
            if (date == currentDate) {
                // Can get cache
                delete require.cache[require.resolve(`../cache/${date}/scoreboard.json`)];
                json = require(`../cache/${date}/scoreboard.json`);
            } else {
                if (fs.existsSync(`./cache/${date}/scoreboard.json`)) {
                    delete require.cache[require.resolve(`../cache/${date}/scoreboard.json`)];
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
            }

            let bets = await query(con, `SELECT * FROM bets WHERE d${date} IS NOT NULL AND d${date} <> ""${(userSpecified) ? ` AND ID = "${userSpecified}"` : ``};`);
            console.log(`bets length: ${bets.length}`);
    
            userLoop: for (var i = 0; i < bets.length; i++) { // Cycling through each user with bets on that date
                let bet = bets[i];
                if (bet.ID == `placeholder1234567`) continue;

                let embed = new Discord.MessageEmbed()
                    .setTitle(`Claimed bets for ${new Date(date.substring(0, 4), parseInt(date.substring(4, 6)) - 1, date.substring(6, 8)).toDateString()}:`)
                    .setColor(teamColors.NBA);
                let description = ``;

                let user = await getUser(con, `users`, bet.ID);
                user = user[0];

                bet = bet[`d${date}`].split(`,`);
                console.log(`${user.ID}: ${bet}`);

                betLoop: for (var j = 0; j < bet.length; j++) { // Cycling through each bet on that date

                    if (bet[j].includes(`+`)) { // Parlay
                        let details = bet[j].split(`|`); // Key components of parlay: TEAMS|PLACED|PAYOUT
                        let teams = details[0].split(`+`); // All teams in parlay for that date
                        let allCorrect = true, allDone = true, lostTeam;

                        gameLoop: for (var k = 0; k < json.games.length; k++) {
                            let c = json.games[k];

                            if (teams.includes(c.awayTeam.teamTricode) || teams.includes(c.homeTeam.teamTricode)) {
                                // Game finished?
                                if (c.gameStatus < 3) {
                                    // Game not done, so whole parlay cannot be claimed
                                    allDone = false;
                                    break gameLoop;
                                }

                                // Game finished, did the chosen team lose?
                                let location = (teams.includes(c.awayTeam.teamTricode)) ? `awayTeam` : `homeTeam`;
                                let other = (location == `awayTeam`) ? `homeTeam` : `awayTeam`;
                                if (parseInt(c[location].score) < parseInt(c[other].score)) {
                                    // Chosen team lost so whole parlay invalid
                                    allCorrect = false;
                                    lostTeam = c[location].teamTricode;
                                    break gameLoop;
                                }
                            }
                        }

                        if (!allDone) {
                            // Not all done, so leave it for now
                            continue betLoop;
                        }

                        if (!allCorrect) {
                            // Logging
                            console.log(`user ${user.ID} failed claim parlay ${bet[j]} on ${date}`);

                            // Parlay wrong!
                            description += `:red_square: ${teamEmojis[lostTeam]} lost, so whole parlay of ${teams.join(`, `)} lost → \`$0.00\` gained.\n`;
                            user.Wrong++;
                            betsClaimed++;
                        } else {
                            // Logging
                            console.log(`user ${user.ID} won claim parlay ${bet[j]} on ${date}`);

                            // Parlay correct! Give them the money
                            description += `:green_square: ${teams.join(`, `)} won → \`$${details[2]}\` gained.`;
                            user.Correct++;
                            user.Balance += parseFloat(details[2]);
                            user.Balance = parseFloat(user.Balance.toFixed(2));
                            betsClaimed++;
                        }

                        bet.splice(j, 1);
                    } 
                    
                    else { // Normal bet
                        let details = bet[j].split(`|`);
                        if (teamSpecified) {
                            if (teamSpecified == details[0]) continue betLoop;
                        }

                        gameLoop: for (var k = 0; k < json.games.length; k++) {
                            let location;
                            if (json.games[k].awayTeam.teamTricode == details[0] && json.games[k].gameStatus == 3) location = `awayTeam`;
                            else if (json.games[k].homeTeam.teamTricode == details[0] && json.games[k].gameStatus == 3) location = `homeTeam`;
                            if (!location) continue gameLoop;

                            if (parseInt(json.games[k][location].score) > parseInt(json.games[k][(location == `awayTeam` ? `homeTeam` : `awayTeam`)].score)) { // Bet won
                                // Logging
                                console.log(`user ${user.ID} won claim bet ${bet[j]} on ${date}`);

                                user.Balance += parseFloat(details[2]);
                                user.Correct++;
                                description += `:green_square: ${teamEmojis[details[0]]} won → \`$${details[2]}\` gained.\n`;
                            } else { // Bet lost
                                // Logging
                                console.log(`user ${user.ID} failed claim bet ${bet[j]} on ${date}`);

                                user.Wrong++;
                                description += `:red_square: ${teamEmojis[details[0]]} lost → \`$0.00\` gained.\n`;
                            }

                            betsClaimed++;
                            
                            bet.splice(j, 1);

                            break gameLoop;
                        }
                    }
                }

                if (!description) continue userLoop;

                bet = bet.join(`,`);
                await query(con, `UPDATE bets SET d${date} = "${bet}" WHERE ID = "${user.ID}";`);

                await updateUser(con, `users`, user.ID, user);

                embed.setDescription(description);

                let u = await client.users.fetch(user.ID);
                if (!u) continue userLoop;
                try {
                    await u.send({ embeds: [embed] });
                } catch (e) {
                    console.log(e);
                }

            }

            resolve(betsClaimed);
            return;
        });
}
