// Core variables
let config = require(`./config.json`);
let runningOriginalNBABot = config.runningOriginalNBABot;
let runDatabase = config.runDatabase;

// Libraries
const Discord = require(`discord.js`);
const fs = require(`fs`);
const mysql = require(`mysql`);
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

// Assets
const teamColors = require(`./assets/teams/colors.json`);
const teamEmojis = require(`./assets/teams/emojis.json`);

// Methods
const logger = require(`./methods/logger.js`);
const getUser = require(`./methods/database/get-user.js`);
const getJSON = require(`./methods/get-json.js`);
const createUser = require(`./methods/database/create-user.js`);
const query = require(`./methods/database/query.js`);
const formatDuration = require(`./methods/format-duration.js`);
const randInt = require(`./methods/randint.js`);

// Core Discord variables
const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES] });

// Sorting out command structure
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
commandLoop: for (const file of commandFiles) {
	let databaseInvolvedCommands = [`balance`, `bet`, `bets`, `claim`, `img-add`, `img-delete`, `img`, `imgs`, `leaderboard`, `rbet`, `reset-balance`, `settings`];
	if (databaseInvolvedCommands.includes(file.split(`.`)[0]) && !runDatabase) continue commandLoop;
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

// Initialising mysql database
let con;
if (runDatabase) {
	con = mysql.createConnection({
		host: `localhost`,
		user: config.databaseUsername,
		password: config.databasePassword,
		database: config.databaseName
	});
	
	con.connect();
}

client.on(`ready`, async () => {
	module.exports = { con, client, runDatabase, shardID, sortOutShards };
	clientReady = true;
	logger.ready(`Ready!`);

	updateActivity();
	await sortOutShards();

	DonatorScores();
	setInterval(DonatorScores, 1000 * 60);
});

function updateCommands(ID) {
	return new Promise(async resolve => {
		// Getting command data
		const commands = [];
		const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

		let version = await query(con, `SELECT * FROM guilds WHERE ID = "current";`);
		version = version[0].Version;
		let guildResult = await query(con, `SELECT * FROM guilds WHERE ID = "${ID}";`), guildExists = true;
		if (!guildResult) guildExists = false;
		else if (guildResult.length == 0) guildExists = false;

		if (guildExists) {
			await query(con, `UPDATE guilds SET Version = ${version} WHERE ID = "${ID}";`);
			guildResult = guildResult[0];
		} else {
			await query(con, `INSERT INTO guilds VALUES ("${ID}", ${version}, "y", NULL);`);
			guildResult = {ID: ID, Version: version, Betting: `y`};
		}

		commandLoop: for (const file of commandFiles) {
			let databaseInvolvedCommands = [`balance`, `bet`, `bets`, `claim`, `img-add`, `img-delete`, `img`, `imgs`, `leaderboard`, `rbet`, `reset-balance`, `settings`];
			if (databaseInvolvedCommands.includes(file.split(`.`)[0]) && !runDatabase) continue commandLoop;

			let bettingCommands = config.commands.betting;
			if (guildResult.Betting == `n` && bettingCommands.includes(file.split(`.`)[0])) continue commandLoop;
			
			const command = require(`./commands/${file}`);
			commands.push(command.data.toJSON());
		}

		const rest = new REST({ version: '9' }).setToken(config.token);
		rest.put(Routes.applicationGuildCommands(config.clientId, ID), { body: commands })
			.then(async () => {
				resolve();
			})
			.catch(err => {
				// I dont really care if I can't add commands, the server needs to add that
				resolve();
			});
	});
}

async function updateAllServerCommands() {
	// Getting all servers
	client.shard.fetchClientValues(`guilds.cache`)
		.then(async res => {
			for (var i = 0; i < res.length; i++) {
				for(var j = 0; j < res[i].length; j++) {
					if (j % 25 == 0) console.log(`${i}: ${j}/${res[i].length}`);
					await updateCommands(res[i][j].id);
				}
			}
		});
}

client.on(`guildCreate`, async guild => { // NBABot joins guild
	const commands = [];
	const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

	let version = await query(con, `SELECT Version FROM guilds WHERE ID = "current";`);
	version = version[0].Version;
	let guildResult = await query(con, `SELECT * FROM guilds WHERE ID = "${guild.id}";`), guildExists = true;
	if (!guildResult) guildExists = false;
	else if (guildResult.length == 0) guildExists = false;

	if (guildExists) {
		await query(con, `UPDATE guilds SET Version = ${version} WHERE ID = "${guild.id}";`);
		guildResult = guildResult[0];
	} else {
		await query(con, `INSERT INTO guilds VALUES ("${guild.id}", ${version}, "y", NULL);`);
		guildResult = {ID: guild.id, Version: version, Betting: `y`};
	}

	commandLoop: for (const file of commandFiles) {
		let databaseInvolvedCommands = [`balance`, `bet`, `bets`, `claim`, `img-add`, `img-delete`, `img`, `imgs`, `leaderboard`, `rbet`, `reset-balance`, `settings`];
		if (databaseInvolvedCommands.includes(file.split(`.`)[0]) && !runDatabase) continue commandLoop;

		let bettingCommands = config.commands.betting;
		if (guildResult.Betting == `n` && bettingCommands.includes(file.split(`.`)[0])) continue commandLoop;

		const command = require(`./commands/${file}`);
		commands.push(command.data.toJSON());
	}

	const rest = new REST({ version: '9' }).setToken(config.token);

	rest.put(Routes.applicationGuildCommands(config.clientId, guild.id), { body: commands })
		.then(async () => {
			console.log(`Successfully registered application commands for guild ${guild.id}.`);
		});
});

// On @NBABot message (mention)
client.on(`messageCreate`, async message => {
	let args = message.content.toLowerCase().split(` `);
	if (!args?.[0] || !args?.[1]) return;

	if (args[1].toLowerCase() == `update`) {
		let msg = await message.channel.send(`Updating...`);

		const commands = [];
		const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

		let version = await query(con, `SELECT Version FROM guilds WHERE ID = "current";`);
		version = version[0].Version;
		let guild = await query(con, `SELECT * FROM guilds WHERE ID = "${message.guild.id}";`), guildExists = true;
		if (!guild) guildExists = false;
		else if (guild.length == 0) guildExists = false;

		if (guildExists) {
			await query(con, `UPDATE guilds SET Version = ${version} WHERE ID = "${message.guild.id}";`);
			guild = guild[0];
		} else {
			await query(con, `INSERT INTO guilds VALUES ("${message.guild.id}", ${version}, "y", NULL);`);
			guild = {ID: message.guild.id, Version: version, Betting: `y`};
		}

		commandLoop: for (const file of commandFiles) {
			let databaseInvolvedCommands = [`balance`, `bet`, `bets`, `claim`, `img-add`, `img-delete`, `img`, `imgs`, `leaderboard`, `rbet`, `reset-balance`, `settings`];
			if (databaseInvolvedCommands.includes(file.split(`.`)[0]) && !runDatabase) continue commandLoop;

			let bettingCommands = config.commands.betting;
			if (guild.Betting == `n` && bettingCommands.includes(file.split(`.`)[0])) continue commandLoop;
			
			const command = require(`./commands/${file}`);
			commands.push(command.data.toJSON());
		}

		const rest = new REST({ version: '9' }).setToken(config.token);

		rest.put(Routes.applicationGuildCommands(config.clientId, message.guild.id), { body: commands })
			.then(async () => {
				console.log('Successfully registered application commands for guild ${message.guild.id}.');

				return await msg.edit(`Slash commands successfully added, enjoy!`);
			})
			.catch(async error => {
				if (error) {
					console.log(error);
					return await msg.edit(`:no_entry_sign: Unable to add slash commands, give NBABot permission here: **https://discord.com/api/oauth2/authorize?client_id=544017840760422417&permissions=534723816512&scope=bot%20applications.commands**.`);
				}
			});

	}

	// Cutoff for admin-based commands
	if (!config.adminIDs.includes(message.author.id)) return;

	switch(args[1].toLowerCase()) {
		case `post`:
			if (!runningOriginalNBABot) return;
			const DiscordBotList = require(`dblapi.js`);
			const dbl = new DiscordBotList(config.dbl);

			let res = await client.shard.fetchClientValues(`guilds.cache.size`);
			res = res.reduce((a, b) => a + b, 0);

			await dbl.postStats(res);

			return await message.channel.send(`Posted ${res} server count.`);
			break;
		
		case `eval`:
			let response = eval(message.content.split(`@<${config.clientId}> eval`).join(``));
			console.log(response);
			return message.channel.send(response);
			break;

		case `update-all-commands`:
			updateAllServerCommands();
			break;

		case `update-odds`:
			// Format:
			// @NBABot update-odds yyyymmdd GSW 110 WAS -200
			if (args.length < 7) return await message.channel.send(`7 arguments required.`);

			let odds = [args[4], args[6]]; // [awayTeam, homeTeam]

			// Checking for decimal odds to convert to US format
			for (var i = 0; i < odds.length; i++) {
				if (odds[i].includes(`.`)) {
					odds[i] = parseFloat(odds[i]);
					if (odds[i] > 2) {
						odds[i] = parseInt(100 * (odds[i] - 1));
					} else {
						odds[i] = parseInt(100 / (1 - odds[i]));
					}
					args[(i == 0) ? 4 : 6] = odds[i];
				}
			}

			let obj;
			try {
				obj = require(`./cache/${args[2]}/odds.json`);
			} catch (e) {
				obj = {};
			}
			obj[`${args[3].toUpperCase()} @ ${args[5].toUpperCase()}`] = {awayTeamOdds: {moneyLine: parseInt(args[4])}, homeTeamOdds: {moneyLine: parseInt(args[6])}};
	
			fs.writeFileSync(`./cache/${args[2]}/odds.json`, JSON.stringify(obj), err => console.log(err));
	
			return await message.channel.send(`Odds updated! New ${args[2]} odds:\n\`${JSON.stringify(obj)}\``);
			break;

		case `user-stats`:
			let totalCount = await query(con, `SELECT COUNT(*) FROM users;`);
			totalCount = totalCount[0][`COUNT(*)`];
			return await message.channel.send(`Total: \`${totalCount}\``);
			break;

		case `bet-stats`:
			if (!args[2]) { // currentDate if not specified
				delete require.cache[require.resolve(`./cache/today.json`)];
				args[2] = require(`./cache/today.json`).links.currentDate;
			}

			let activeBetCount = await query(con, `SELECT COUNT(*) FROM bets WHERE d${args[2]} IS NOT NULL;`);
			activeBetCount = activeBetCount[0][`COUNT(*)`];

			return await message.channel.send(`${args[2]}: \`${activeBetCount}\``);
			break;

		case `shard`:
			return await message.channel.send(`Shard: ${shardID}`);
			break;

		case `update-user`:
			// @NBABot update-user ID Name Value
			if (args.length != 5) return;
			switch(args[3].toLowerCase()) {
				case `balance`: // number
				case `borrect`:
				case `wrong`:
					await query(con, `UPDATE users SET ${args[3]} = ${args[4]} WHERE ID = "${args[2]}";`);
					return await message.channel.send(`UPDATED users SET \`${args[3]}\` = \`${args[4]}\` WHERE ID = "\`${args[2]}\`";`);
					break;

				case `favouriteteam`: // string
				case `description`:
				case `donator`:
				case `hints`:
				case `guilds`:
				case `odds`:
				case `dateformat`:
				case `scorechannels`:
				case `lastweekly`:
					await query(con, `UPDATE users SET ${args[3]} = "${args[4]}" WHERE ID = "${args[2]}";`);
					return await message.channel.send(`UPDATED users SET \`${args[3]}]\` = "\`${args[4]}\`" WHERE ID = "\`${args[2]}\`";`);
					break;

				default:
					return;
					break;
			}
			break;

		case `bot-stats`:
			// @NBABot bot-stats yyyymmdd
			let chosenDate;
			if (!args[2] || !parseInt(args[2])) {
				delete require.cache[require.resolve(`./cache/today.json`)];
				chosenDate = require(`./cache/today.json`).links.currentDate;
			} else chosenDate = args[2];

			let stats = await query(con, `SELECT * FROM stats WHERE Date = "${chosenDate}";`);
			
			if (!stats) return;
			else if (stats.length == 0) return;

			stats = stats[0];

			let str = `__**${stats.Date}**__, Total: \`${stats.Total}\``;
			statLoop: for (var key in stats) {
				if ([`Date`, `Total`].includes(key)) continue statLoop;
				str += `\n${key}: \`${stats[key]}\``;
			}

			return await message.channel.send(str);
			break;	

		case `query`:
			args.shift(); args.shift();
			args = args.join(` `);

			let q;
			try {
				q = await query(con, args);
			} catch (e) {
				return await message.channel.send(e);
			}
			return await message.channel.send(`\`\`\`json\n${JSON.stringify(q)}\`\`\``);
			break;

		case `claim`:
			let date = args?.[2];
			if (!date) return;
			if (!parseInt(date) || date.length != 8) return;

			await claimBets(date);
			return await message.channel.send(`Done`);
			break;
	}
});


// On / command
client.on(`interactionCreate`, async interaction => {
	// Refreshing config.json
	delete require.cache[require.resolve(`./config.json`)];
	config = require(`./config.json`);

	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);
	if (!command) return;

	// Finding current time
	let offset = 13; // Converts logging stuff to NZ time, feel free to change this utc offset
	let localTime = new Date(new Date().getTime() + offset * 3600000);

	if (runDatabase) {
		// Registering user on users database if not already
		let user = await getUser(con, `users`, interaction.user.id), userExists = true;
		if (!user) userExists = false;
		else if (user.length == 0) userExists = false;
		if (!userExists) {
			let totalCount = await query(con, `SELECT COUNT(*) FROM users;`);
			totalCount = totalCount[0][`COUNT(*)`];
			console.log(`[${totalCount}] Creating user ${interaction.user.id}`);
			await createUser(con, `users`, interaction.user.id);
		}
		
		// Registering user on bets database if not already
		let bets = await getUser(con, `bets`, interaction.user.id), betsExists = true;
		if (!bets) betsExists = false;
		else if (bets.length == 0) betsExists = false;
		if (!betsExists) await createUser(con, `bets`, interaction.user.id);

		// Adding guild to Guilds if not already there
		let guilds = await query(con, `SELECT Guilds FROM users WHERE ID = "${interaction.user.id}";`);
		if (!guilds) await query(con, `UPDATE users SET Guilds = "${interaction.guild.id}" WHERE ID = "${interaction.user.id}";`);
		else if (!guilds[0]) await query(con, `UPDATE users SET Guilds = "${interaction.guild.id}" WHERE ID = "${interaction.user.id}";`);
		else if (!guilds[0].Guilds) await query(con, `UPDATE users SET Guilds = "${interaction.guild.id}" WHERE ID = "${interaction.user.id}";`);
		else {
			guilds = guilds[0].Guilds;
			guilds = guilds.split(`,`);
			if (!guilds.includes(interaction.guild.id)) {
				guilds.push(interaction.guild.id);
				guilds.join(`,`);
				await query(con, `UPDATE users SET Guilds = "${guilds}" WHERE ID = "${interaction.user.id}";`);
			}
		}

		delete require.cache[require.resolve(`./cache/today.json`)];
		let todayDate = require(`./cache/today.json`).links.currentDate;

		// Add to stats
		let currentStats = await query(con, `SELECT * FROM stats WHERE Date = "${todayDate}";`), currentStatsExists = true;
		if (!currentStats) currentStatsExists = false;
		else if (currentStats.length == 0) currentStatsExists = false;

		if (!currentStatsExists) {
			// Getting reference row
			let ref = await query(con, `SELECT * FROM stats WHERE Date = "20221013";`);
			ref = ref[0];
			let extraStr = ``;

			currentStats = { Date: todayDate, Total: 0 };
			refLoop: for (var key in ref) {
				if ([`Date`, `Total`].includes(key)) continue refLoop;
				extraStr += `, 0`;
				currentStats[key] = 0;
			}

			try {
				await query(con, `INSERT INTO stats VALUES ("${todayDate}", 0${extraStr});`);
			} catch (e) {
				// ...
			}
		} else currentStats = currentStats[0];

		currentStats.Total++;

		console.log(`[${currentStats.Total}][${localTime.toISOString()}][${interaction.guild.id}][${interaction.user.id}]: ${interaction.commandName}`);

		if (interaction.commandName.includes(`-`)) { // commands like player-stats can't work as mysql columns
			interaction.commandName = interaction.commandName.split(`-`).join(``);
		}

		if (currentStats[interaction.commandName]) {
			currentStats[interaction.commandName]++;
		} else {
			try {
				await query(con, `ALTER TABLE stats ADD COLUMN ${interaction.commandName} MEDIUMINT;`);
			} catch (e) {
				// ...
			}

			await query(con, `UPDATE stats SET ${interaction.commandName} = 0 WHERE ${interaction.commandName} IS NULL;`);
			currentStats[interaction.commandName] = 1;
		}

		await query(con, `UPDATE stats SET Total = ${currentStats.Total}, ${interaction.commandName} = ${currentStats[interaction.commandName]} WHERE Date = "${todayDate}";`);
	} else {
		console.log(`[${localTime.toISOString()}][${interaction.guild.id}][${interaction.user.id}]: ${interaction.commandName}`)
	}

	let guild = await query(con, `SELECT * FROM guilds WHERE ID = "${interaction.guild.id}";`), guildExists = true;
	if (!guild) guildExists = false;
	else if (guild.length == 0) guildExists = false;

	if (guildExists) {
		guild = guild[0];
	} else {
		await query(con, `INSERT INTO guilds VALUES ("${message.guild.id}", ${version}, "y", NULL);`);
		guild = {ID: message.guild.id, Version: version, Betting: `y`};
	}

	let betting = (guild.Betting == `y`) ? true : false;

	let ad = null;

	// Sorting out whether ads/betting is allowed
	if (runDatabase) {
		let user = await query(con, `SELECT * FROM users WHERE ID = "${interaction.user.id}";`);
		user = user[0];

		// Checking if the server is exempt at all
		let users = await query(con, `SELECT * FROM users WHERE Donator <> "n";`);
		let removeAds = false;
		userLoop: for (var i = 0; i < users.length; i++) {
			if (!users[i].AdFreeServer) continue;
			if (!users[i].AdFreeServer.split(`,`)) continue;
			if (users[i].AdFreeServer.split(`,`).length == 0) continue;
			if (users[i].AdFreeServer.split(`,`).includes(interaction.guild.id)) {
				removeAds = true;
				break userLoop;
			}
		}

		let guild = await query(con, `SELECT * FROM guilds WHERE ID = "${interaction.guild.id}";`);
		guild = guild[0];

		if (guild.BettingChannel) {
			let channel;
			try {
				channel = await interaction.guild.channels.fetch(guild.bettingChannel);
			} catch (e) {
				console.log(`Unknown channel!`);
				channel = null;
			}
			if (channel && guild.BettingChannel != interaction.channel.id && config.commands.betting.includes(interaction.commandName)) {
				return await interaction.reply(`Betting is only enabled in <#${guild.BettingChannel}>. Use \`/settings betting-channel\` to change this.`);
			}
		}

		if ((user.Ads == "y" || user.Donator == "n") && !removeAds) { // Show ads
			delete require.cache[require.resolve(`./config.json`)];
			let ads = require(`./config.json`).ads;
			ad = ads[randInt(0, ads.length - 1)];
		}

		// Checking for betting disabled for server or user
		if (!betting && config.commands.betting.includes(interaction.commandName)) {
			return await interaction.reply(`Betting is disabled in this server.`);
		}
		if (user.Betting == `n` && config.commands.betting.includes(interaction.commandName)) {
			return await interaction.reply(`Betting is disabled for this user. Change this with \`/settings betting\`.`);
		}
		if (user.Betting == `n`) betting = false;

		try {
			await command.execute({ interaction, client, con, ad, betting, shardID });
		} catch (error) {
			console.log(error);
			logger.error(error);
			return interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	} else {
		try {
			await command.execute({ interaction, client });
		} catch (error) {
			console.log(error);
			logger.error(error);
			return interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

// Logging in
client.login(config.token);

// process events
process.on("uncaughtException", (err) => {
	const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
	logger.error(`Uncaught Exception: ${errorMsg}`);
	console.error(err);
	// Always best practice to let the code crash on uncaught exceptions. 
	// Because you should be catching them anyway.
	process.exit(1);
});
  
process.on("unhandledRejection", err => {
	logger.error(`Unhandled rejection: ${err}`);
	console.error(err);
});

// Removing connection to database on exit
process.on(`exit`, () => {
	con.end();
});

let shardID;
process.on(`message`, message => {
	if (!message.type) return false;
	if (message.type == `shardId`) shardID = message.data.shardId;
});

// Updating cache
const methods = require(`./methods/update-cache.js`);
const claimBets = require('./methods/claim-bets');

// Cache and updating stuff
methods.updateDate();
setInterval(methods.updateDate, 1000 * 60 * 5);

methods.updateScores();
setInterval(methods.updateScores, 1000 * 20);

methods.updateFutureScores();
setInterval(methods.updateFutureScores, 1000 * 60 * 60);

methods.updateOddsNew();
setInterval(methods.updateOddsNew, 1000 * 60 * 30);

function updateActivity() {
	delete require.cache[require.resolve(`./config.json`)];
	let activityText = require(`./config.json`).activityText;
	client.user.setActivity(activityText);
}
setInterval(updateActivity, 1000 * 60 * 30);

// Every minute
async function DonatorScores() {
    // ID - 0000
    // ScoreChannels - server-channel-message-yyyymmdd,repeat

	await sortOutShards();

    let donators = await query(con, `SELECT * FROM users WHERE Donator = "f";`);

    let channels = [], userIDs = [];
    donatorLoop: for (var i = 0; i < donators.length; i++) {
        let user = donators[i];
        
		if (user.Donator != `y` && user.Donator != `f`) continue donatorLoop;
        if (!user.ScoreChannels) continue donatorLoop;
		if (user.ScoreChannels == "NULL" || user.ScoreChannels == `null`) continue donatorLoop;

        let userChannels = user.ScoreChannels.split(`,`);
        if (!userChannels[0]) continue donatorLoop;

        for (var j = 0; j < userChannels.length; j++) {
            channels.push(userChannels[j]);
            userIDs.push(user.ID);
        }
    }

    if (channels.length == 0) return;

	// Checking if we're in the right shard
	let validChannels = 0;
	for (var i = 0; i < channels.length; i++) {
		let details = channels[i].split(`-`);
		if (details[4].toString() == shardID.toString()) validChannels++; 
	}
	if (validChannels == 0) return;

    // Finding currentDate
    delete require.cache[require.resolve(`./cache/today.json`)];
    let currentDate = require(`./cache/today.json`).links.currentDate;
    let dateObject = new Date(currentDate.substring(0, 4), parseInt(currentDate.substring(4, 6)) - 1, currentDate.substring(6, 8));

    let embed = new Discord.MessageEmbed()
        .setTitle(`${teamEmojis.NBA} __NBA Scores for ${dateObject.toDateString()}__`)
        .setColor(teamColors.NBA)
		.setTimestamp()
		.setFooter({ text: `Last updated `});

    // Getting/formating scores embed

	// Seeing whether I can fetch from cache or a new request is needed
	let json, usedCache = false;
	if (fs.existsSync(`./cache/${currentDate}/`)) {
		if (fs.existsSync(`./cache/${currentDate}/scoreboard.json`)) {
			json = require(`./cache/${currentDate}/scoreboard.json`);
			usedCache = true;
		}
	}
	if (!json) {
		json = await getJSON(`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`);
	}

    // Checking if the API reponse is valid
    let numGames = 1;
    if (!json) numGames = 0;
    else if (!json?.games) numGames = 0;
    else if (json?.games?.length == 0) numGames = 0;
    if (!numGames) {
		console.log(`No games found, returning`);
		return;
	}

    // Cycle through each game and add details to a field
    let gamesFinished = 0;
    let embedsAdded = 0;
    gameLoop: for (var i = 0; i < json.games.length; i++) {
        let c = json.games[i];

        if (c.gameStatus == 3) gamesFinished++; 

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
    
    // Sending/updating messages
    channelLoop: for (var i = 0; i < channels.length; i++) {
        let details = channels[i].split(`-`); // server-channel-msg-yyymmdd-shard
		if (details[4].toString() != shardID.toString()) {
			continue channelLoop;
		}
        if (details[3] == currentDate) { // Last message is same day, so no change = update
			let channel;
			try {
				channel = await client.channels.fetch(details[1]);
			} catch (e) {
				console.log(e);
			}
			if (!channel) console.log(`${details[1]} not found.`);
			
			let message;
			try {
				message = await channel.messages.fetch(details[2]);
			} catch (e) {
				console.log(e);
				try {
					message = await channel.send({ embeds: [embed] });
				} catch (e) {
					console.log(e);
				}

				details[2] = message.id;
				await query(con, `UPDATE users SET ScoreChannels = "${details.join(`-`)}" WHERE ID = "${userIDs[i]}";`);
				continue;
			}
			
			await message.edit({ embeds: [embed] });
			continue;
        } else { // New date, so new message
			let channel, message;
			try {
				channel = await client.channels.fetch(details[1]);
			} catch (e) {
				console.log(e);
				continue;
			}

			try {
				message = await channel.send({ embeds: [embed] });
			} catch (e) {
				console.log(e);
				continue;
			}
            details[2] = message.id;
            details[3] = currentDate;
            await query(con, `UPDATE users SET ScoreChannels = "${details.join(`-`)}" WHERE ID = "${userIDs[i]}";`);
        }
    } 
}

async function sortOutShards() { // Assigning shard locations to 
	let users = await query(con, `SELECT * FROM users WHERE Donator = "f";`);
	for (var i = 0; i < users.length; i++) {
		let user = users[i];
		if (!user.ScoreChannels) continue;
		if (user.ScoreChannels == "NULL") continue;
		// guild-channel-msg-date-shard
		let details = user.ScoreChannels.split(`-`);
		if (details.length != 5) continue;

		let channel;
		try {
			channel = await client.channels.fetch(details[1]);
		} catch (e) {
			console.log(e);
		}
		if (!channel) continue;

		// Cool, so we know this shard has that channel in it
		details[4] = shardID.toString();
		await query(con, `UPDATE users SET ScoreChannels = "${details.join(`-`)}" WHERE ID = "${user.ID}"`);
	}
}