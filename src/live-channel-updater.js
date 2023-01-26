// Libraries
const Discord = require(`discord.js`);
const mysql = require(`mysql`);
const fs = require(`fs`);
const fetch = require(`node-fetch`);
const cheerio = require(`cheerio`);

const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES] });

// JSON files
const config = require(`./config.json`);

// Assets
const teamColors = require(`./assets/teams/colors.json`);
const teamEmojis = require(`./assets/teams/emojis.json`);
const teams = require(`./assets/teams/details.json`);
const rotowireTeamSolutions = { PHO: `PHX` };

// Methods
const getJSON = require(`./methods/get-json.js`);
const getHTML = require(`./methods/get-html.js`);
const query = require(`./methods/database/query.js`);
const getValue = require(`./methods/database/get-value.js`);
const formatDuration = require(`./methods/format-duration.js`);
const randInt = require(`./methods/randint.js`);

// Initialising mysql database
let con = mysql.createConnection({
	host: `localhost`,
	user: config.databaseUsername,
	password: config.databasePassword,
	database: config.databaseName
});

con.connect();

client.on(`ready`, async () => {
    console.log(`${client.user.tag} is ready!`);
    await client.user.setStatus(`invisible`);

    Scores();
    Transactions();
    News();
    PlayerNews();
    Injuries();

    setInterval(Scores, 1000 * 60);
    setInterval(Transactions, 1000 * 60 * 5);
    setInterval(News, 1000 * 60 * 60);
    setInterval(PlayerNews, 1000 * 60 * 5);
    setInterval(Injuries, 1000 * 60 * 5);
});

// Every 5 minutes
async function Transactions() {
    let b = await getJSON(`https://stats.nba.com/js/data/playermovement/NBA_Player_Movement.json`);

    if (!b) return;
    if (!b.NBA_Player_Movement) return;
    if (!b.NBA_Player_Movement.rows) return;

    let fields = [];
    
    let embed = new Discord.MessageEmbed()
        .setColor(teamColors.NBA)
        .setTimestamp()
        .setAuthor({name: `NBABot (nbabot.js.org)`, iconURL: `https://cdn.discordapp.com/avatars/544017840760422417/2f4585b982abde74155ceaaa4c61d454.png?size=64`, url: `https://nbabot.js.org/`});

    // Going through each transaction on record and see if it has been sent before, if not, send
    transactionLoop: for (var i = 0; i < b.NBA_Player_Movement.rows.length; i++) {
        // Reserving more transactions ffor the next message (max 25 per message)
        if (fields.length >= 25) break;

        let t = b.NBA_Player_Movement.rows[i];
        // Seeing if it is on the database
        let d = await query(con, `SELECT * FROM transactions WHERE ID = '${t.GroupSort}';`), exists = true;
        if (!d) exists = false;
        if (d.length == 0) exists = false;
        if (exists) continue transactionLoop;

        fields.push([`${t.Transaction_Type} by the ${t.TEAM_SLUG[0].toUpperCase()}${t.TEAM_SLUG.substring(1, t.TEAM_SLUG.length)}`, t.TRANSACTION_DESCRIPTION]);
        await query(con, `INSERT INTO transactions VALUES ('${t.GroupSort}', 'y');`);
    }

    if (fields.length == 0) return;

    embed.setTitle(`New Player Transaction${(fields.length > 1) ? `s` : ``}`);

    for (var i = 0; i < fields.length; i++) {
        embed.addField(fields[i][0], fields[i][1], false);
    }

    let channel = await client.channels.fetch(config.transactionChannel);
    let message = await channel.send({ embeds: [embed] });
    try {
        await message.crosspost();
    } catch (e) {
        // ...
    }
}

// Every 20 minutes
async function Scores() {
    let lastEdited = await getValue(con, `scores_games_finished`, `Date`, `lastedit`);
    lastEdited = parseInt(lastEdited.Finished);

    delete require.cache[require.resolve(`./cache/today.json`)];
    let currentDate = require(`./cache/today.json`).links.currentDate;

    let currentDateObject = new Date(parseInt(currentDate.substring(0, 4)), parseInt(currentDate.substring(4, 6)) - 1, parseInt(currentDate.substring(6, 8)));
    let beforeDateObject = new Date(currentDateObject.getTime() - 86400000);
    let beforeDate = beforeDateObject.toISOString().substring(0, 10).split(`-`).join(``);

    if (new Date().getTime() - 1000 * 60 * 20 < lastEdited) return;

    let beforeDateGamesFinished;
    try {
        beforeDateGamesFinished = await getValue(con, `scores_games_finished`, `Date`, beforeDate);
    } catch (e) {
        await query(con, `INSERT INTO scores_games_finished VALUES ("${beforeDate}", "n");`);
    }

    if (!beforeDateGamesFinished) {
        await query(con, `INSERT INTO scores_games_finished VALUES ("${beforeDate}", "n");`);
        beforeDateGamesFinished = await getValue(con, `scores_games_finished`, `Date`, beforeDate);
    }
    beforeDateGamesFinished = beforeDateGamesFinished?.Finished;

    let changedDate = false;
    if (beforeDateGamesFinished) {
        if (beforeDateGamesFinished == `n`) {
            currentDate = beforeDate;
            changedDate = true;
        }
    }

    let createMessage = false;
    let scoreMessage = await getValue(con, `scores_messages`, `Date`, currentDate);
    if (!scoreMessage) createMessage = true;

	// Seeing whether I can fetch from cache or a new request is needed
	let b, usedCache = false;
	if (fs.existsSync(`./cache/${currentDate}/`)) {
		if (fs.existsSync(`./cache/${currentDate}/scoreboard.json`)) {
            delete require.cache[require.resolve(`./cache/${currentDate}/scoreboard.json`)];
			b = require(`./cache/${currentDate}/scoreboard.json`);
			usedCache = true;
		}
	}
	if (!b && !usedCache) {
        if (changedDate) {
            b = await getJSON(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`);

            let dates = b.leagueSchedule.gameDates;
            for (var i = 0; i < dates.length; i++) {
                let d = new Date(dates[i].gameDate);
                d = d.toISOString().substring(0, 10).split(`-`).join(``);
                if (d == currentDate) {
                    b = dates[i];
                }
            }
        } else {
            b = await getJSON(`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`);
            b = b?.scoreboard;
        }
	}

    /* temp
    b = await getJSON(`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`);
    b = b?.scoreboard; */

    if (!b) return;
    if (!b.games) return;
    if (b.games.length == 0) return;

    let json = b;

    let dateString = new Date(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8)).toDateString();

    let embed = new Discord.MessageEmbed()
        .setTitle(`<:NBA:582679355373649950> __Scores for ${dateString}__`)
        .setFooter({ text: `Last updated `})
        .setTimestamp()
        .setAuthor({ name: `NBABot (nbabot.js.org)`, iconURL: `https://cdn.discordapp.com/avatars/544017840760422417/2f4585b982abde74155ceaaa4c61d454.png?size=64`, url: `https://nbabot.js.org/`})
        .setDescription(`This message is edited roughly every 20 minutes.`)
        .setColor(teamColors.NBA);

    let gamesStillOn = 0;

    // Cycle through each game and add details to a field
    let gamesFinished = 0;
    let embedsAdded = 0;
    gameLoop: for (var i = 0; i < json.games.length; i++) {
        let c = json.games[i];

        if (c.gameStatus == 3) gamesFinished++; 
        if (c.gameStatus < 3) gamesStillOn++;

		let str1 = `${(c.gameStatus == 1) ? `(${c.awayTeam.wins}-${c.awayTeam.losses})` : ``} ${teamEmojis[c.awayTeam.teamTricode]} ${(c.gameStatus == 3 && parseInt(c.awayTeam.score) > parseInt(c.homeTeam.score)) ? `__` : ``}${c.awayTeam.teamTricode} ${c.awayTeam.score}${(c.gameStatus == 3 && parseInt(c.awayTeam.score) > parseInt(c.homeTeam.score)) ? `__` : ``} @ ${(c.gameStatus == 3 && parseInt(c.homeTeam.score) > parseInt(c.awayTeam.score)) ? `__` : ``}${c.homeTeam.score} ${c.homeTeam.teamTricode}${(c.gameStatus == 3 && parseInt(c.homeTeam.score) > parseInt(c.awayTeam.score)) ? `__` : ``} ${teamEmojis[c.homeTeam.teamTricode]} ${(c.gameStatus == 1) ? `(${c.homeTeam.wins}-${c.homeTeam.losses}) ` : ``}| ${c.gameStatusText}`;
		let str2 = ``;
		// Add countdown if game yet to start
		if (c.gameStatus == 1) { 
			if (c.gameDateTimeUTC) {
				let msUntilStart = (new Date(c.gameDateTimeUTC).getTime() - new Date().getTime());
				if (msUntilStart <= 0) {
					str2 += `Starting at any moment`;
				} else {
					str2 += `Starting ${formatDuration(new Date(c.gameDateTimeUTC).getTime())}`;
				}
			} else if (c.gameTimeUTC) {
				let msUntilStart = (new Date(c.gameTimeUTC).getTime() - new Date().getTime());
				if (msUntilStart <= 0) {
					str2 += `Starting at any moment`;
				} else {
					str2 += `Starting ${formatDuration(new Date(c.gameTimeUTC).getTime())}`;
				}
			}
		} else str2 += `...`;

        if (c.gameLeaders && c.gameStatus == 3) {
            if (c.gameLeaders.homeLeaders && c.gameLeaders.awayLeaders) {
                if (str2 == `...`) {
                    str2 = `${c.gameLeaders.awayLeaders.name}: \`${c.gameLeaders.awayLeaders.points}\`pts \`${c.gameLeaders.awayLeaders.assists}\`ast \`${c.gameLeaders.awayLeaders.rebounds}\`reb\n${c.gameLeaders.homeLeaders.name}: \`${c.gameLeaders.homeLeaders.points}\`pts \`${c.gameLeaders.homeLeaders.assists}\`ast \`${c.gameLeaders.homeLeaders.rebounds}\`reb`;
                } else {
                    str2 += `${c.gameLeaders.awayLeaders.name}: \`${c.gameLeaders.awayLeaders.points}\`pts \`${c.gameLeaders.awayLeaders.assists}\`ast \`${c.gameLeaders.awayLeaders.rebounds}\`reb\n${c.gameLeaders.homeLeaders.name}: \`${c.gameLeaders.homeLeaders.points}\`pts \`${c.gameLeaders.homeLeaders.assists}\`ast \`${c.gameLeaders.homeLeaders.rebounds}\`reb`;
                }
            }
        } else if (c.pointsLeaders && c.gameStatus == 3) {
            if (c.pointsLeaders.length > 0) {
                let str3 = ``;
                for (var j = 0; j < c.pointsLeaders.length; j++) {
                    str3 += `${c.pointsLeaders[j].firstName} ${c.pointsLeaders[j].lastName}: \`${parseInt(c.pointsLeaders[j].points)}\`pts\n`;
                }
                if (str2 == `...`) {
                    str2 = str3;
                } else {
                    str2 += str3;
                }
            }
        }
        
        embed.addField(str1, str2);
        embedsAdded++;
    }

    // Checking that today's finished games is in the database
    let scores_games_finished_today;
    try {
        scores_games_finished = await getValue(con, `scores_games_finished`, `Date`, currentDate);
    } catch (e) {
        await query(con, `INSERT INTO scores_games_finished VALUES ("${currentDate}", "n");`);
    }
    if (!scores_games_finished) await query(con, `INSERT INTO scores_games_finished VALUES ("${currentDate}", "n");`);

    if (gamesStillOn == 0) {
        await query(con, `UPDATE scores_games_finished SET Finished = "y" WHERE Date = "${currentDate}";`);
    } else await query(con, `UPDATE scores_games_finished SET Finished = "n" WHERE Date = "${currentDate}";`);

    if (createMessage) {
        let channel = await client.channels.fetch(config.scoreChannel);
        let message = await channel.send({ embeds: [embed] });
        try {
            await message.crosspost();
        } catch (e) {
            // ...
        }

        await query(con, `INSERT INTO scores_messages VALUES ('${currentDate}', '${config.nbaGuild}-${config.scoreChannel}-${message.id}');`);
        await query(con, `UPDATE scores_games_finished SET Finished = "${new Date().getTime()}" WHERE Date = "lastedit";`);
    } else {
        try {
            let details = await getValue(con, `scores_messages`, `Date`, currentDate);
            details = details.Details;
            let channel = await client.channels.fetch(details.split(`-`)[1]);
            let message = await channel.messages.fetch(details.split(`-`)[2]);
            await message.edit({ embeds: [embed] });
            await query(con, `UPDATE scores_games_finished SET Finished = "${new Date().getTime()}" WHERE Date = "lastedit";`);
        } catch (e) {
            console.log(e);
        }
    }
}

// Every minute
async function donatorScores() {
    // ID - 0000
    // ScoreChannels - server-channel-message-yyyymmdd,repeat

    let donators = query(`SELECT * FROM users WHERE ScoreChannels IS NOT NULL;`);

    let channels = [], userIDs = [];
    donatorLoop: for (var i = 0; i < donators.length; i++) {
        let user = donators[i];

        if (user.Donator != `y` && user.Donator != `f`) continue donatorLoop;
        if (!user.ScoreChannels) continue donatorLoop;
        let userChannels = user.ScoreChannels.split(`,`);
        if (!userChannels[0]) continue donatorLoop;
        for (var j = 0; j < userChannels.length; j++) {
            channels.push(userChannels[j]);
            userIDs.push(user.ID);
        }
    }

    if (channels.length == 0) return;

    // Finding currentDate
    delete require.cache[require.resolve(`./cache/today.json`)];
    let currentDate = require(`./cache/today.json`).links.currentDate;
    let dateObject = new Date(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8));

    let embed = new Discord.MessageEmbed()
        .setTitle(`${teamEmojis.NBA} NBA Scores for ${dateObject.toDateString()}`)
        .setColor(teamColors.NBA);

    // Getting/formating scores embed
    let json = await getJSON(`http://data.nba.net/10s/prod/v1/${currentDate}/scoreboard.json`);

    // Checking if the API reponse is valid
    let numGames = 1;
    if (!json) numGames = 0;
    else if (!json?.games) numGames = 0;
    else if (json?.games?.length == 0) numGames = 0;
    if (!numGames) return;

    // Cycle through each game and add details to a field
    let gamesFinished = 0;
    let embedsAdded = 0;
    gameLoop: for (var i = 0; i < json.games.length; i++) {
        let c = json.games[i];

        if (c.statusNum == 3) gamesFinished++; 
        
        let str1 = `${(c.statusNum == 1) ? `(${c.vTeam.win}-${c.vTeam.loss})` : ``} ${teamEmojis[c.vTeam.triCode]} ${(c.statusNum == 3 && parseInt(c.vTeam.score) > parseInt(c.hTeam.score)) ? `__` : ``}${c.vTeam.triCode} ${c.vTeam.score}${(c.statusNum == 3 && parseInt(c.vTeam.score) > parseInt(c.hTeam.score)) ? `__` : ``} @ ${(c.statusNum == 3 && parseInt(c.hTeam.score) > parseInt(c.vTeam.score)) ? `__` : ``}${c.hTeam.score} ${c.hTeam.triCode}${(c.statusNum == 3 && parseInt(c.hTeam.score) > parseInt(c.vTeam.score)) ? `__` : ``} ${teamEmojis[c.hTeam.triCode]} ${(c.statusNum == 1) ? `(${c.hTeam.win}-${c.hTeam.loss})` : ``}${(c.statusNum == 1) ? `` : ((c.statusNum == 2) ? `${(c.period.current > 4) ? `| OT` : `| Q`}${c.period.current} ${c.clock}` : `| FINAL ${(c.period.current > 4) ? `${c.period.current - 4}OT` : ``}`)}`;
        let str2 = ``;
        if (c.playoffs) str2 += `*${c.playoffs.seriesSummaryText}*\n`;

        // Add countdown if game yet to start
        if (c.statusNum == 1) { 
            let msUntilStart = (new Date(c.startTimeUTC).getTime() - new Date().getTime());
            if (msUntilStart <= 0) {
                str2 += `Starting at any moment`;
            } else {
                str2 += `Starting ${formatDuration(new Date(c.startTimeUTC).getTime())}`;
            }
        } else {
            str2 += `${(c.nugget.text) ? ((c.nugget.text != `` || c.nugget.text != ` `) ? `Summary: ${c.nugget.text}` : ((c.statusNum == 1) ? `` : `...`)) : ((c.statusNum == 1) ? `` : `...`)}`;
        }

        // Game leaders if possible
        if (str2.endsWith(`...`) && c.statusNum == 3) {
            // Checking if there is a cached boxscore to pull data from
            if (fs.existsSync(path.join(__dirname, `./cache/${currentDate}/${c.gameId}_boxscore.json`))) {
                let cachedBoxscore = require(`../cache/${currentDate}/${c.gameId}_boxscore.json`);
                let leaders = { points: {}, assists: {}, rebounds: {} };

                for (var stat in leaders) {
                    let v = parseInt(cachedBoxscore.stats.vTeam.leaders[stat].value), h = parseInt(cachedBoxscore.stats.hTeam.leaders[stat].value);
                    if (v > h) {
                        leaders[stat] = cachedBoxscore.stats.vTeam.leaders[stat];
                    } else if (v < h) {
                        leaders[stat] = cachedBoxscore.stats.hTeam.leaders[stat];
                    } else {
                        // Merging two player arrays
                        leaders[stat] = cachedBoxscore.stats.vTeam.leaders[stat];
                        leaders[stat].players = leaders[stat].players.concat(cachedBoxscore.stats.hTeam.leaders[stat].players);
                    }
                    let arr = [];
                    playerLoop: for (var j = 0; j < leaders[stat].players.length; j++) {
                        // if (!leaders[stat].players[j].firstName || !leaders[stat].players[j].lastName) continue;
                        if (typeof leaders[stat].players[j] == `string`) {
                            arr.push(`${leaders[stat].players[j].split(` `)[0][0]}. ${leaders[stat].players[j].split(leaders[stat].players[j].split(` `)[0]).join(``)}`);
                        } else if (leaders[stat].players[j].firstName && leaders[stat].players[j].lastName) {
                            arr.push(`${leaders[stat].players[j].firstName.substring(0, 1)}. ${leaders[stat].players[j].lastName}`);
                        } else continue playerLoop;
                    }
                    leaders[stat].players = arr;
                }
                str2 = str2.substring(0, str2.length - 3);
                str2 += `**Leaders:** \`${leaders.points.value}\` pts (${leaders.points.players.join(`, `)}), \`${leaders.assists.value}\` ast (${leaders.assists.players.join(`, `)}), \`${leaders.rebounds.value}\` reb (${leaders.rebounds.players.join(`, `)})`;
            }
        }
        
        embed.addField(str1, str2);
        embedsAdded++;
    }
    
    // Sending/updating messages
    channelLoop: for (var i = 0; i < channels.length; i++) {
        let details = channels[i].split(`-`); // server-channel-msg-yyymmdd
        if (details[3] == currentDate) { // Last message is same day, so no change = update
            let channel = await client.channels.fetch(details[1]);
            let message = await channel.messages.fetch(details[2]);
            await message.edit({ embeds: [embed] });
        } else { // New date, so new message
            let channel = await client.channels.fetch(details[1]);
            let message = await channel.send({ embeds: [embed] });
            try {
                await message.crosspost();
            } catch (e) {
                // ...
            }
            details[3] = message.id;
            details[4] = currentDate;
            await query(con, `UPDATE users SET ScoreChannels = "${details.join(`-`)}" WHERE ID = "${userIDs[i]}";`);
        }
    } 
}

// Every hour
async function News() {
    let sent = await getValue(con, `news`, `Date`, new Date().toISOString().substring(0, 10).split(`-`).join(``));
    if (sent) return;

    let b = await getJSON(`http://site.api.espn.com/apis/site/v2/sports/basketball/nba/news`);

    let randomArticle = randInt(0, b.articles.length - 1);
    
    let embed = new Discord.MessageEmbed()
        .setTitle(`:newspaper: Today's NBA News from ESPN:`)
        .setAuthor({ name: `NBABot (nbabot.js.org)`, iconURL: `https://cdn.discordapp.com/avatars/544017840760422417/2f4585b982abde74155ceaaa4c61d454.png?size=64`, url: `https://nbabot.js.org/`})
        .setTimestamp()
        .setImage(b.articles[randomArticle].images[0].url)
        .setColor(teamColors.NBA);

    for (var i = 0; i < b.articles.length; i++) {
        embed.addField(`${i + 1}) ${b.articles[i].headline}${(i == randomArticle) ? ` (Pictured)` : ``}`, `${b.articles[i].description} [Link](${b.articles[i].links.web.href})`);
    }

    let channel = await client.channels.fetch(config.newsChannel);
    let message = await channel.send({ embeds: [embed] });
    try {
        await message.crosspost();
    } catch (e) {
        // ...
    }

    await query(con, `INSERT INTO news VALUES ('${new Date().toISOString().substring(0, 10).split(`-`).join(``)}', 'y');`);

    // Getting current season
    delete require.cache[require.resolve(`./cache/today.json`)];
    const seasonScheduleYear = require(`./cache/today.json`).seasonScheduleYear;

    let json = await getHTML(`https://www.espn.com/nba/standings/`);

    json = json.substring(json.search(`{"app":`), json.length);
    json = json.substring(0, json.search(`};`) + 1); 
    json = JSON.parse(json);
    json = json.page.content.standings.groups.groups;

    let embed2 = new Discord.MessageEmbed()
        .setTitle(`${seasonScheduleYear}-${seasonScheduleYear + 1} League Standings:`)
        .setTimestamp()
        .setColor(teamColors.NBA);
        
    let w = 10, l = 6, g = 4, s = 8;

    for (var k = 0; k < json.length; k++) {
        let description = `\`     Team    W-L  PCT   GB  STR\`\n`;

        let teams = json[k].standings;
        
        let top = 0;
        for (var i = 0; i < teams.length; i++) {
            let len = teams[i].stats[w].length + teams[i].stats[l].length + 1;
            if (len > top) top = len;
        }
        for (var i = 0; i < teams.length; i++) {
            let solutions = { "UTAH": "UTA", "GS": "GSW", "NY": "NYK", "SA": "SAS", "NO": "NOP", "WSH": "WAS" };
            if (solutions[teams[i].team.abbrev]) teams[i].team.abbrev = solutions[teams[i].team.abbrev];
            if (teams[i].stats[g] == `-`) teams[i].stats[g] = `0`;

            let team = teams[i];
            let record = ``;
            if (team.stats[w].length + team.stats[l].length + 1 < top) {
                for (var j = 0; j < top - (team.stats[w].length + team.stats[l].length + 1); j++) {
                    record += ` `;
                }
                record += `${team.stats[w]}-${team.stats[l]}`;
            } else record = `${team.stats[w]}-${team.stats[l]}`;

            let percentage = ((parseInt(team.stats[w]) / (parseInt(team.stats[w]) + parseInt(team.stats[l]))) * 100).toPrecision(3);
            if (parseInt(team.stats[w]) + parseInt(team.stats[l]) == 0) percentage = `0.00`;
            else if (parseInt(team.stats[l]) == 0) percentage = `100 `;

            if (parseFloat(team.stats[g]) - Math.floor(parseFloat(team.stats[g])) == 0) team.stats[g] = `${team.stats[g]}.0`;

            if (team.stats[s] == `-`) team.stats[s] = `- `;
            description += `\`${(i + 1 < 10) ? `0${i + 1}` : i + 1}) \`${teamEmojis[team.team.abbrev]}\`${team.team.abbrev} | ${record} ${percentage} ${(parseFloat(team.stats[g]) < 10) ? `0${parseFloat(team.stats[g]).toFixed(1)}` : parseFloat(team.stats[g]).toFixed(1)}  ${team.stats[s]}\`\n`;
        }

        embed2.addField(`${json[k].name} Standings:`, description);
    }

    let channel2 = await client.channels.fetch(config.standingsChannel);
    let message2 = await channel2.send({ embeds: [embed2] });
    try {
        await message2.crosspost();
    } catch (e) {
        // ...
    }
}

/*
// Every 10 minutes
async function Injuries() { // Not finished yets
    // let teams = ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'];

    let b = await getJSON(`https://www.rotowire.com/basketball/tables/injury-report.php?team=ALL&pos=ALL`);
    let playersChecked = [];
    let fields = [];
    for (var i = 0; i < b.length; i++) {
        // Get player's last injury
        let injury = await getValue(con, `injuries`, `Name`, b[i].player);
        if (!injury) { // No injury before, register user
            await query(con, `INSERT INTO injuries VALUES ('${b[i].player}', 'None', 'None');`);
            injury = { Name: b[i].player, Injury: `None`, Status: `None` };
        }

        let old = injury;
        let current = b[i];

        playersChecked.push(current.player);

        // Different scenarios: stayed the same, injury changed, status changed, both changed
        if (old.Injury == current.injury && old.Status != current.status) { // Different status
            fields.push([`${teamEmojis[current.team]} Changed status for ${current.player}${(current.player[current.player.length - 1] == `s`) ? `'` : `'s`} ${current.injury} injury`, `Before: ${old.Status}, Now: ${current.status}`]);
        } else if (old.Injury != current.injury && old.Status == current.status) { // Different injury
            fields.push([`${teamEmojis[current.team]} Changed injury for ${current.player}${(current.player[current.player.length - 1] == `s`) ? `'` : `'s`}`, `Before: ${old.Injury}, Now: ${current.injury}`]);
        } else if (old.Injury != current.injury && old.Status != current.status) { // Both different
            if (old.Injury == `None` && old.Status == `None`) { // New injury
                fields.push([`${teamEmojis[current.team]} New injury for ${current.player}`, `Injury: ${current.injury}, Status: ${current.status}`]);
            } else fields.push([`${teamEmojis[current.team]} Changed injury for ${current.player}${(current.player[current.player.length - 1] == `s`) ? `'` : `'s`}`, `Before: ${old.Injury}, Now: ${current.injury} injury - ${current.status}`]);
        }

        // Set current injury into database
        await query(con, `UPDATE injuries SET Injury = '${current.injury}', Status = '${current.status}' WHERE Name = "${current.player}";`);
    }

    let playersReturnedToNormal = 0;
    let players = await query(con, `SELECT * FROM injuries;`);
    for (var i = 0; i < players.length; i++) {
        if (!playersChecked.includes(players[i].Name)) {
            playersReturnedToNormal++;
            await query(con, `UPDATE injuries SET Injury = 'None', Status = 'None' WHERE Name = "${players[i].Name}";`);
            // Add injury removed??
        }
    }

    console.log(`Injuries - fields: ${fields.length}, playersChecked: ${playersChecked}, returned: ${playersReturnedToNormal}`);

    let embed = new Discord.MessageEmbed()
        .setTitle(`__New injury update${(fields.length > 1) ? `s`: ``}:__`)
        .setColor(teamColors.NBA)
        .setTimestamp()
        .setAuthor({ name: `NBABot (nbabot.js.org)`, iconURL: `https://cdn.discordapp.com/avatars/544017840760422417/2f4585b982abde74155ceaaa4c61d454.png?size=64`, url: `https://nbabot.js.org/` });

    for (var i = 0; i < fields.length; i++) {
        if (i > 24) continue;
        embed.addField(fields[i][0], fields[i][1]);
    }

    // Getting channel
    let channel = await client.channels.fetch(config.injuriesChannel);
    let message = await channel.send({ embeds: [embed] });
    try {
        await message.crosspost();
    } catch (e) {
        // ...
    }
}*/

// Every 5 minutes
async function PlayerNews() {
    // Checking if the bot can send another message
    let lastMessage = await query(con, `SELECT * FROM player_news WHERE Description = "lastmessage";`);
    lastMessage = lastMessage[0].Time;
    if (new Date().getTime() < (lastMessage + 1000 * 60 * 5)) return;

    let a = await fetch(`https://www.rotowire.com/basketball/news.php`);
    a = await a.text();
    let $ = cheerio.load(a);

    let names = [], headlines = [], descriptions = [], teams = [];

    $(`a.news-update__player-link`).each((i, e) => {
        names.push($(e).text());
    });
    
    $(`div.news-update__headline`).each((i, e) => {
        headlines.push($(e).text());
    });

    $(`div.news-update__news`).each((i, e) => {
        let d = $(e).text();
        if (d.length > 500) d = `${d.substring(0, 500)}...`;
        descriptions.push(d);
    });

    $(`img.news-update__logo`).each((i, e) => {
        let team = $(e).attr(`alt`);
        if (rotowireTeamSolutions[team]) team = rotowireTeamSolutions[team];
        teams.push(team);
    });

    let embed = new Discord.MessageEmbed()
        .setColor(teamColors.NBA)
        .setTimestamp()
        .setAuthor({ name: `NBABot (nbabot.js.org)`, url: `https://nbabot.js.org/`, iconURL: `https://raw.githubusercontent.com/NBABot-Development-Team/NBABot/master/src/assets/logo.png` });

    let fieldsAdded = 0;

    mainLoop: for (var i = 0; i < descriptions.length; i++) {
        if (fieldsAdded >= 25) break mainLoop; // Embeds can only have 25 fields

        // Sanitizing description - replacing " with '
        if (descriptions[i].includes(`"`)) {
            descriptions[i] = descriptions[i].split(``);
            for (var j = 0; j < descriptions[i].length; j++) {
                if (descriptions[i][j] == `"`) descriptions[i][j] = `'`;
            }
            descriptions[i] = descriptions[i].join(``);
        }

        // Seeing if the update description is already in the database
        let a = await query(con, `SELECT * FROM player_news WHERE Description = "${descriptions[i]}";`);

        let aExists = true;
        if (!a) aExists = false;
        else if (a.length == 0) aExists = false;

        if (aExists) { 
            // Seeing if the last mention was ages ago (>1 day ago) - then it must be new
            if (new Date(a[0].Time).getTime() + 1000 * 60 * 60 * 24 * 7 * 3 > new Date().getTime()) {
                continue mainLoop;
            }
        }

        let teamEmoji;
        if (teamEmojis[teams[i]]) teamEmoji = teamEmojis[teams[i]];

        embed.addField(`${teamEmoji} ${names[i]} ${headlines[i]}`, descriptions[i]);
        fieldsAdded++;

        if (aExists) {
            await query(con, `UPDATE player_news SET Time = ${new Date().getTime()} WHERE Description = "${descriptions[i]}";`);
        } else await query(con, `INSERT INTO player_news VALUES (${new Date().getTime()}, "${descriptions[i]}");`);
    }

    if (fieldsAdded > 0) {
        let channel = await client.channels.fetch(config.playerNewsChannel);
        let message = await channel.send({ embeds: [embed] });
        await query(con, `UPDATE player_news SET Time = ${new Date().getTime()} WHERE Description = "lastmessage";`);
        try {
            await message.crosspost();
        } catch (e) {
            // ...
        }
    }
}

async function Injuries() {
    // https://www.rotowire.com/basketball/news.php?team=PHX&view=injuries
    // https://www.rotowire.com/basketball/news.php?view=injuries

    let channels = config.injuryChannels;

    teamLoop: for (var team in channels) {
        // Checking if the bot can send another message
        let lastMessage = await query(con, `SELECT * FROM player_injuries_${team} WHERE Description = "lastmessage";`);
        lastMessage = lastMessage[0].Time;
        if (new Date().getTime() < (lastMessage + 1000 * 60 * 5)) continue teamLoop;

        let a = await fetch(`https://www.rotowire.com/basketball/news.php?view=injuries${(team != `ALL`) ? `&team=${team}` : ``}`);
        a = await a.text();
        let $ = cheerio.load(a);

        let names = [], headlines = [], descriptions = [], teams = [];

        $(`a.news-update__player-link`).each((i, e) => {
            names.push($(e).text());
        });
        
        $(`div.news-update__headline`).each((i, e) => {
            headlines.push($(e).text());
        });

        $(`div.news-update__news`).each((i, e) => {
            let d = $(e).text();
            if (d.length > 500) d = `${d.substring(0, 500)}...`;
            descriptions.push(d);
        });

        $(`img.news-update__logo`).each((i, e) => {
            let thisTeam = $(e).attr(`alt`);
            if (rotowireTeamSolutions[thisTeam]) thisTeam = rotowireTeamSolutions[thisTeam];
            teams.push(thisTeam);
        });

        let embed = new Discord.MessageEmbed()
            .setColor((team == `ALL`) ? teamColors.NBA : teamColors[team])
            .setTimestamp()
            .setAuthor({ name: `NBABot (nbabot.js.org)`, url: `https://nbabot.js.org/`, iconURL: `https://raw.githubusercontent.com/NBABot-Development-Team/NBABot/master/src/assets/logo.png` });

        let fieldsAdded = 0;

        mainLoop: for (var i = 0; i < descriptions.length; i++) {
            if (fieldsAdded >= 25) break mainLoop; // Embeds can only have 25 fields
            // Seeing if the update description is already in the database
            
            // Santizing descriptions[i]
            if (descriptions[i].includes(`"`)) {
                descriptions[i] = descriptions[i].split(``);
                for (var j = 0; j < descriptions[i].length; j++) {
                    if (descriptions[i][j] == `"`) descriptions[i][j] = `'`;
                }
                descriptions[i] = descriptions[i].join(``);
            }
            let a = await query(con, `SELECT * FROM player_injuries_${team} WHERE Description = "${descriptions[i]}";`);

            let aExists = true;
            if (!a) aExists = false;
            else if (a.length == 0) aExists = false;

            if (aExists) { 
                // Seeing if the last mention was ages ago (>1 day ago) - then it must be new
                if (new Date(a[0].Time).getTime() + 1000 * 60 * 60 * 24 * 21 > new Date().getTime()) {
                    continue mainLoop;
                }
            }

            embed.addField(`${team == `ALL` ? `${teamEmojis[teams[i]]} ` : ``}${names[i]} ${headlines[i]}`, descriptions[i]);
            fieldsAdded++;

            if (aExists) {
                await query(con, `UPDATE player_injuries_${team} SET Time = ${new Date().getTime()} WHERE Description = "${descriptions[i]}";`);
            } else await query(con, `INSERT INTO player_injuries_${team} VALUES (${new Date().getTime()}, "${descriptions[i]}");`);
        }

        if (fieldsAdded > 0) {
            let channel = await client.channels.fetch(channels[team]);
            let message = await channel.send({ embeds: [embed] });
            await query(con, `UPDATE player_injuries_${team} SET Time = ${new Date().getTime()} WHERE Description = "lastmessage";`);
            try {
                await message.crosspost();
            } catch (e) {
                // ...
            }
        }
    }
}

async function createTables() {
    let teams = Object.keys(config.injuryChannels);

    for (var i = 0; i < teams.length; i++) {
        await query(con, `CREATE TABLE player_injuries_${teams[i]} (Time bigint, Description varchar(512));`);
        await query(con, `INSERT INTO player_injuries_${teams[i]} VALUES (${new Date().getTime()}, "lastmessage");`);
    }
}

client.login(config.token2);