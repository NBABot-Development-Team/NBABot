// Libraries
const Discord = require(`discord.js`);
const mysql = require(`mysql`);

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

    setInterval(Scores, 1000 * 60 * 20);
    setInterval(Transactions, 1000 * 60 * 5);
    setInterval(News, 1000 * 60 * 60);
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
    console.log(`Got past lastedit difference`);

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

    console.log(`Got to after beforeDate stuff`);

    if (beforeDateGamesFinished) {
        if (beforeDateGamesFinished == `n`) {
            currentDate = beforeDate;
        }
    }

    let createMessage = false;
    let scoreMessage = await getValue(con, `scores_messages`, `Date`, currentDate);
    if (!scoreMessage) createMessage = true;

    let b = await getJSON(`http://data.nba.net/10s/prod/v1/${currentDate}/scoreboard.json`);

    console.log(b);

    if (!b) return;
    if (!b.games) return;
    if (b.games.length == 0) return;

    let dateString = new Date(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8)).toDateString();

    console.log(`Got to embed`);
    let embed = new Discord.MessageEmbed()
        .setTitle(`<:NBA:582679355373649950> Scores for ${dateString}`)
        .setFooter({ text: `Last edited: `})
        .setTimestamp()
        .setAuthor({ name: `NBABot (nbabot.js.org)`, iconURL: `https://cdn.discordapp.com/avatars/544017840760422417/2f4585b982abde74155ceaaa4c61d454.png?size=64`, url: `https://nbabot.js.org/`})
        .setDescription(`This message is edited roughly every 20 minutes.`)
        .setColor(teamColors.NBA);

    let gamesStillOn = 0;
    for (var i = 0; i < b.games.length; i++) {
        let hTeam, vTeam;
        let c = b.games[i];
        
        if (c.statusNum == 2) gamesStillOn++;

        // Getting a more detailed team object from /cache/teams.json to use nickname
        for (var j = 0; j < teams.league.standard.length; j++) {
            if (teams.league.standard[j].tricode == c.hTeam.triCode) hTeam = teams.league.standard[j];
            if (teams.league.standard[j].tricode == c.vTeam.triCode) vTeam = teams.league.standard[j];
        }

        if (!hTeam || !vTeam) { // Very unnecessary check
            hTeam = {nickname: c.hTeam.triCode};
            vTeam = {nickname: c.vTeam.triCode};
        }

        let str1 = `${(c.statusNum == 1) ? `(${c.vTeam.win}-${c.vTeam.loss})` : ``} ${teamEmojis[c.vTeam.triCode]}${(c.statusNum == 3 && parseInt(c.vTeam.score) > parseInt(c.hTeam.score)) ? `__` : ``}${vTeam.nickname}${(c.statusNum == 3 && parseInt(c.vTeam.score) > parseInt(c.hTeam.score)) ? `__` : ``} ${c.vTeam.score} @ ${c.hTeam.score} ${(c.statusNum == 3 && parseInt(c.hTeam.score) > parseInt(c.vTeam.score)) ? `__` : ``}${hTeam.nickname}${(c.statusNum == 3 && parseInt(c.hTeam.score) > parseInt(c.vTeam.score)) ? `__` : ``} ${teamEmojis[c.hTeam.triCode]}${(c.statusNum == 1) ? `(${c.hTeam.win}-${c.hTeam.loss})` : ``}${(c.statusNum == 1) ? `` : ((c.statusNum == 2) ? `${(c.period.current > 4) ? ` | OT` : ` | Q`}${c.period.current} ${c.clock}` : ` | FINAL ${(c.period.current > 4) ? `${c.period.current - 4}OT` : ``}`)}`;
        let str2 = `${(c.nugget.text) ? ((c.nugget.text != `` || c.nugget.text != ` `) ? `Summary: ${c.nugget.text}` : ((c.statusNum == 1) ? `` : `...`)) : ((c.statusNum == 1) ? `` : `...`)}`;

        if (c.playoffs) str2 += `\n${c.playoffs.seriesSummaryText}`; // Playoffs series summary

        if (c.statusNum == 1) { // Adding betting and countdown
            str2 += (new Date(c.startTimeUTC).getTime() - new Date().getTime() <= 0) ? `\nStarting soon...` : `\nStarting ${formatDuration(new Date(c.startTimeUTC).getTime())}`;
        }

        embed.addField(str1, str2);
    }

    console.log(`Got past data insertion`);

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
    let donators = query(`SELECT * FROM users WHERE ScoreChannels IS NOT NULL;`);

    let channels = [];
    donatorLoop: for (var i = 0; i < donators.length; i++) {
        let user = donators[i];

        if (user.Donator != `y`) continue donatorLoop;
        if (!user.ScoreChannels) continue donatorLoop;
        let userChannels = user.ScoreChannels.split(`,`);
        if (!userChannels[0]) continue donatorLoop;
        for (var j = 0; j < userChannels.length; j++) {
            channels.push(userChannels[j]);
        }
    }

    if (channels.length == 0) return;

    
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

        let fields = [];

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
        await query(con, `UPDATE injuries SET Injury = '${current.injury}', Status = '${current.status}' WHERE Name = '${current.player}';`);
    }

    let playersReturnedToNormal = 0;
    let players = await query(con, `SELECT * FROM injuries;`);
    for (var i = 0; i < players.length; i++) {
        if (!playersChecked.includes(players[i].Name)) {
            playersReturnedToNormal++;
            await query(con, `UPDATE injuries SET Injury = 'None', Status = 'None' WHERE Name = '${players[i].Name}';`);
            // Add injury removed??
        }
    }

    console.log(`Injuries - fields: ${fields.length}, playersChecked: ${playersChecked}, returned: ${playersReturnedToNormal}`);

    let embed = new Discord.MessageEmbed()
        .setTitle(`New injury updates:`)
        .setColor(teamColors.NBA)
        .setTimestamp()
        .setAuthor({ name: `NBABot (nbabot.js.org)`, iconURL: `https://cdn.discordapp.com/avatars/544017840760422417/2f4585b982abde74155ceaaa4c61d454.png?size=64`, url: `https://nbabot.js.org/` });

    for (var i = 0; i < fields.length; i++) {
        
    }
} 

client.login(config.token2);