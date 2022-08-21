// Libraries
const Discord = require(`discord.js`);

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

            let json = await getJSON(`http://data.nba.net/10s/prod/v1/${date}/scoreboard.json`);

            let bets = await query(con, `SELECT * FROM bets WHERE d${date} IS NOT NULL${(userSpecified) ? ` AND ID = "${userSpecified}"` : ``};`);
    
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

                betLoop: for (var j = 0; j < bet.length; j++) { // Cycling through each bet on that date
                    let details = bet[j].split(`|`);
                    if (teamSpecified) {
                        if (teamSpecified == details[0]) continue betLoop;
                    }

                    gameLoop: for (var k = 0; k < json.games.length; k++) {
                        let location;
                        if (json.games[k].vTeam.triCode == details[0] && json.games[k].statusNum == 3) location = `vTeam`;
                        else if (json.games[k].hTeam.triCode == details[0] && json.games[k].statusNum == 3) location = `hTeam`;
                        if (!location) continue gameLoop;

                        if (parseInt(json.games[k][location].score) > parseInt(json.games[k][(location == `vTeam` ? `hTeam` : `vTeam`)].score)) { // Bet won
                            user.Balance += parseFloat(details[2]);
                            user.Correct++;
                            description += `:green_square: ${teamEmojis[details[0]]} won, $${details[2]} gained.\n`;
                        } else { // Bet lost
                            user.Wrong++;
                            description += `:red_square: ${teamEmojis[details[0]]} lost, $0.00 gained.\n`;
                        }

                        betsClaimed++;
                        
                        console.log(`1: ${bet}`);
                        bet.splice(j, 1);
                        console.log(`2: ${bet}`);

                        break gameLoop;
                    }

                    console.log(j);
                }

                console.log(`abc`);

                if (!description) continue userLoop;

                bet = bet.join(`,`);
                await query(con, `UPDATE bets SET d${date} = "${bet}" WHERE ID = "${user.ID}";`);

                await updateUser(con, `users`, user.ID, user);

                embed.setDescription(description);

                let u = await client.users.fetch(user.ID);
                if (!u) continue userLoop;
                await u.send({ embeds: [embed] });

            }

            resolve(betsClaimed);
            return;
        });
}
