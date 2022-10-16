// Libraries
const Discord = require(`discord.js`);
const mysql = require(`mysql`);
const fs = require(`fs`);

const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES] });

// JSON files
const config = require(`./config.json`);

// Assets
const teamColors = require(`./assets/teams/colors.json`);
const teamEmojis = require(`./assets/teams/emojis.json`);
const teams = require(`./assets/teams/details.json`);

// Methods
const getJSON = require(`./methods/get-json.js`);
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
    // Injuries();

    setInterval(Scores, 1000 * 60 * 20);
    setInterval(Transactions, 1000 * 60 * 5);
    setInterval(News, 1000 * 60 * 60);
    // setInterval(Injuries, 1000 * 60 * 5);
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
    await channel.send({ embeds: [embed] });
}

// Every 20 minutes
async function Scores() {
    let lastEdited = await getValue(con, `scores_games_finished`, `Date`, `lastedit`);
    lastEdited = parseInt(lastEdited.Finished);
    console.log(`lastedit difference: ${new Date().getTime() - 1000 * 60 * 20} ${lastEdited}`);
    if (new Date().getTime() - 1000 * 60 * 20 < lastEdited) return;

    delete require.cache[require.resolve(`./cache/today.json`)];
    let currentDate = require(`./cache/today.json`).links.currentDate;

    let currentDateObject = new Date(parseInt(currentDate.substring(0, 4)), parseInt(currentDate.substring(4, 6)) - 1, parseInt(currentDate.substring(6, 8)));
    let beforeDateObject = new Date(currentDateObject.getTime() - 86400000);
    let beforeDate = beforeDateObject.toISOString().substring(0, 10).split(`-`).join(``);

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

    if (beforeDateGamesFinished) {
        if (beforeDateGamesFinished == `n`) {
            currentDate = beforeDate;
        }
    }

    let createMessage = false;
    let scoreMessage = await getValue(con, `scores_messages`, `Date`, currentDate);
    if (!scoreMessage) createMessage = true;

	// Seeing whether I can fetch from cache or a new request is needed
	let b, usedCache = false;
	if (fs.existsSync(`./cache/${currentDate}/`)) {
		if (fs.existsSync(`./cache/${currentDate}/scoreboard.json`)) {
			b = require(`./cache/${currentDate}/scoreboard.json`);
			usedCache = true;
		}
	}
	if (!b) {
		b = await getJSON(`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`);
	}

    if (!b) return;
    if (!b.games) return;
    if (b.games.length == 0) return;

    let json = b;

    let dateString = new Date(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8)).toDateString();

    let embed = new Discord.MessageEmbed()
        .setTitle(`<:NBA:582679355373649950> Scores for ${dateString}`)
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

    console.log(`About to send/edit, createMessage: ${createMessage}`);
    if (createMessage) {
        let channel = await client.channels.fetch(config.scoreChannel);
        let message = await channel.send({ embeds: [embed] });
        await query(con, `INSERT INTO scores_messages VALUES ('${currentDate}', '${config.nbaGuild}-${config.scoreChannel}-${message.id}');`);
        await query(con, `UPDATE TABLE scores_games_finished SET Finished = "${new Date().getTime()}" WHERE Date = "lastedit";`);
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
    await channel.send({ embeds: [embed] });

    await query(con, `INSERT INTO news VALUES ('${new Date().toISOString().substring(0, 10).split(`-`).join(``)}', 'y');`);
}

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
    return await channel.send({ embeds: [embed] });
} 

client.login(config.token2);