// Core variables
const config = require(`./config.json`);
let runningOriginalNBABot = config.runningOriginalNBABot; // Change this to false if running on your own bot
let runDatabase = config.runDatabase;

// Libraries
const Discord = require(`discord.js`);
const fs = require(`fs`);
const fetch = require(`node-fetch`);
const mysql = require(`mysql`);
const express = require(`express`);
const http = require(`http`);
const path = require(`path`);
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

// Sorting out command structure
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
commandLoop: for (const file of commandFiles) {
	let databaseInvolvedCommands = [`balance`, `bet`, `bets`, `claim`, `img-add`, `img-delete`, `img`, `imgs`, `leaderboard`, `rbet`, `reset-balance`, `settings`];
	if (databaseInvolvedCommands.includes(file.split(`.`)[0]) && !runDatabase) continue commandLoop;
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
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

		commandLoop: for (const file of commandFiles) {
			let databaseInvolvedCommands = [`balance`, `bet`, `bets`, `claim`, `img-add`, `img-delete`, `img`, `imgs`, `leaderboard`, `rbet`, `reset-balance`, `settings`];
			if (databaseInvolvedCommands.includes(file.split(`.`)[0]) && !runDatabase) continue commandLoop;
			const command = require(`./commands/${file}`);
			commands.push(command.data.toJSON());
		}

		const rest = new REST({ version: '9' }).setToken(config.token);
		rest.put(Routes.applicationGuildCommands(config.clientId, ID), { body: commands })
			.then(async () => {

				let version = await query(con, `SELECT Version FROM guilds WHERE ID = "current";`);
				version = version[0].Version;
				let guildResult = await query(con, `SELECT * FROM guilds WHERE ID = "${ID}";`), guildExists = true;
				if (!guildResult) guildExists = false;
				else if (guildResult.length == 0) guildExists = false;

				if (guildExists) {
					await query(con, `UPDATE guilds SET Version = ${version} WHERE ID = "${ID}";`);
				} else {
					await query(con, `INSERT INTO guilds VALUES ("${ID}", ${version});`);
				}

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

client.on(`guildCreate`, async guild => {
	const commands = [];
	const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

	commandLoop: for (const file of commandFiles) {
		let databaseInvolvedCommands = [`balance`, `bet`, `bets`, `claim`, `img-add`, `img-delete`, `img`, `imgs`, `leaderboard`, `rbet`, `reset-balance`, `settings`];
		if (databaseInvolvedCommands.includes(file.split(`.`)[0]) && !runDatabase) continue commandLoop;
		const command = require(`./commands/${file}`);
		commands.push(command.data.toJSON());
	}

	const rest = new REST({ version: '9' }).setToken(config.token);

	rest.put(Routes.applicationGuildCommands(config.clientId, guild.id), { body: commands })
		.then(async () => {
			let guildCommands = await guild.commands.fetch();
			let commandsInstalledAtAll = false;
			guildCommands.map(async command => {
				if (command.applicationId == (config.clientId)) {
					commandsInstalledAtAll = true;
				}
			});

			if (commandsInstalledAtAll) {
				console.log('Successfully registered application commands for guild ${message.guild.id}.');
				
				let version = await query(con, `SELECT Version FROM guilds WHERE ID = "current";`);
				version = version[0].Version;
				console.log(version);
				let guildResult = await query(con, `SELECT * FROM guilds WHERE ID = "${guild.id}";`), guildExists = true;
				if (!guildResult) guildExists = false;
				else if (guildResult.length == 0) guildExists = false;

				if (guildExists) {
					await query(con, `UPDATE guilds SET Version = ${version} WHERE ID = "${guild.id}";`);
				} else {
					await query(con, `INSERT INTO guilds VALUES ("${guild.id}", ${version});`);
				}
			}
		});
});

client.on(`messageCreate`, async message => {
	// if (!message.content.startsWith(`nba`)) return;
	let v2commands = [`boxscore`, `box`, `bs`, `b`, `compare-players`, `compare`, `news`, `player-info`, `player-stats`, `roster`, `schedule`, `scores`, `s`, `help`];
	let args = message.content.toLowerCase().split(` `);

	if (!args) return;
	if (!args[0]) return;
	if (!args[1]) return;

	if (args[1].toLowerCase() == `update`) {
		let msg = await message.channel.send(`Updating...`);

		const commands = [];
		const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

		commandLoop: for (const file of commandFiles) {
			let databaseInvolvedCommands = [`balance`, `bet`, `bets`, `claim`, `img-add`, `img-delete`, `img`, `imgs`, `leaderboard`, `rbet`, `reset-balance`, `settings`];
			if (databaseInvolvedCommands.includes(file.split(`.`)[0]) && !runDatabase) continue commandLoop;
			const command = require(`./commands/${file}`);
			commands.push(command.data.toJSON());
		}

		const rest = new REST({ version: '9' }).setToken(config.token);

		rest.put(Routes.applicationGuildCommands(config.clientId, message.guild.id), { body: commands })
			.then(async () => {
				let guildCommands = await message.guild.commands.fetch();
				let commandsInstalledAtAll = true;

				if (commandsInstalledAtAll) {
					console.log('Successfully registered application commands for guild ${message.guild.id}.');
					
					let version = await query(con, `SELECT Version FROM guilds WHERE ID = "current";`);
					version = version[0].Version;
					console.log(version);
					let guild = await query(con, `SELECT * FROM guilds WHERE ID = "${message.guild.id}";`), guildExists = true;
					console.log(guild);
					if (!guild) guildExists = false;
					else if (guild.length == 0) guildExists = false;

					if (guildExists) {
						await query(con, `UPDATE guilds SET Version = ${version} WHERE ID = "${message.guild.id}";`);
					} else {
						await query(con, `INSERT INTO guilds VALUES ("${message.guild.id}", ${version});`);
					}

					return await msg.edit(`Slash commands successfully added, enjoy!`);
				} else return await msg.edit(`:no_entry_sign: Unable to add slash commands, give NBABot permission here: **https://discord.com/api/oauth2/authorize?client_id=544017840760422417&permissions=534723816512&scope=bot%20applications.commands**.`);
			})
			.catch(async error => {
				if (error) {
					console.log(error);
					return await msg.edit(`:no_entry_sign: Unable to add slash commands, give NBABot permission here: **https://discord.com/api/oauth2/authorize?client_id=544017840760422417&permissions=534723816512&scope=bot%20applications.commands**.`);
				}
			});

	}

	if (args.length > 1) {
		if (args[0].toLowerCase() == `nba` && v2commands.includes(args[1].toLowerCase())) {
			let exists = false;
			let commandsOnGuild = await message.guild.commands.fetch();
			commandsOnGuild.map(async command => {
				if (command.applicationId == (config.clientId)) {
					exists = true;
				}
			});
			console.log(exists);

			if (!exists) {
				// Tell them to update to v3
				let embed = new Discord.MessageEmbed()
					.setTitle(`NBABot v3 is out!`)
					.setDescription(`For the upcoming 2022-23 NBA season, NBABot has been updated to support slash commands, among other features and performance improvements.\n**1) Update to v3 with \`nba update\`.\n2) You're done! Run commands like \`/help\` and \`/scores\`.**`)
					.setColor(teamColors.NBA);

				return await message.channel.send({ embeds: [embed] });
			}
		}
	}

	if (![`401649168948396032`, `234792150338895872`].includes(message.author.id)) return;

	if (args[1].toLowerCase() == `post` && runningOriginalNBABot) {
		const DiscordBotList = require(`dblapi.js`);
		const dbl = new DiscordBotList(config.dbl);

		let res = await client.shard.fetchClientValues(`guilds.cache.size`);
		res = res.reduce((a, b) => a + b, 0);

		await dbl.postStats(res);

		return await message.channel.send(`Posted ${res} server count.`);
	}

	switch(args[1].toLowerCase()) {
		case `eval`:
			let response = eval(message.content.split(`@<${config.clientId}> eval`).join(``));
			console.log(response);
			return message.channel.send(response);
			break;

		case `update-all-commands`:
			updateAllServerCommands();
			break;

		case `update-odds`:
			// @<> updateodds 20220930 GSW 110 WAS -200
			if (args.length < 7) return await message.channel.send(`7 arguments required.`);

			let obj = require(`./cache/${args[2]}/odds.json`);
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
					return await message.channel.send(`UPDATED users SET \`${args[3]}]\` = \`${args[4]}\` WHERE ID = "\`${args[2]}\`";`);
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
		
	}
});


// Catching slash command
client.on(`interactionCreate`, async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	// Logging command contents
	let offset = 12; // Converts logging stuff to NZ time, feel free to change this utc offset
	let localTime = new Date(new Date().getTime() + offset * 60 * 60 * 1000);
	console.log(`[${localTime.toISOString()}][${interaction.guild.id}][${interaction.user.id}]: ${interaction.commandName}`);

	if (runDatabase) {
		// Registering user on users database if not already
		let user = await getUser(con, `users`, interaction.user.id), userExists = true;
		if (!user) userExists = false;
		else if (user.length == 0) userExists = false;
		if (!userExists) await createUser(con, `users`, interaction.user.id);
		
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
	}

	let ad = null;
	// Run command
	if (runDatabase) {
		let user = await query(con, `SELECT * FROM users WHERE ID = "${interaction.user.id}";`);
		user = user[0];

		// Checking if the server is exempt at all
		let users = await query(con, `SELECT * FROM users WHERE Donator <> "n";`);
		let removeAds = false;
		userLoop: for (var i = 0; i < users.length; i++) {
			if (users[i].AdFreeServer == interaction.guild.id) {
				removeAds = true;
				break userLoop;
			}
		}

		if ((user.Ads == "y" || user.Donator == "n") && !removeAds) { // Show ads
			delete require.cache[require.resolve(`./config.json`)];
			let ads = require(`./config.json`).ads;
			ad = ads[randInt(0, ads.length - 1)];
		}
		try {
			await command.execute({ interaction, client, con, ad });
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

// Updating cache
const methods = require(`./methods/update-cache.js`);
const { donatorScores } = require('./methods/update-cache.js');

// Cache and updating stuff
methods.updateDate();
setInterval(methods.updateDate, 1000 * 60 * 5);

// methods.updateOdds();
// setInterval(methods.updateOdds, 1000 * 60 * 60);

methods.updateScores();
setInterval(methods.updateScores, 1000 * 20);

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
		if (user.ScoreChannels == "NULL") continue donatorLoop;
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
        .setTitle(`${teamEmojis.NBA} NBA Scores for ${dateObject.toDateString()}`)
        .setColor(teamColors.NBA)
		.setTimestamp()
		.setFooter({ text: `Last updated: `});

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
                let cachedBoxscore = require(`./cache/${currentDate}/${c.gameId}_boxscore.json`);
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
		if (details[4].toString() != shardID.toString()) continue channelLoop;
        if (details[3] == currentDate) { // Last message is same day, so no change = update
            let channel = await client.channels.fetch(details[1]);
            let message = await channel.messages.fetch(details[2]);
            await message.edit({ embeds: [embed] });
        } else { // New date, so new message
			let channel, message;
			channel = await client.channels.fetch(details[1]);
			message = await channel.send({ embeds: [embed] });
            details[2] = message.id;
            details[3] = currentDate;
            await query(con, `UPDATE users SET ScoreChannels = "${details.join(`-`)}" WHERE ID = "${userIDs[i]}";`);
        }
    } 
}

async function sortOutShards() {
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
			// ...
		}
		if (!channel) continue;

		// Cool, so we know this shard has that channel in it
		details[4] = shardID.toString();
		await query(con, `UPDATE users SET ScoreChannels = "${details.join(`-`)}" WHERE ID = "${user.ID}"`);
	}
}

let shardID;
process.on(`message`, message => {
	if (!message.type) return false;

	if (message.type == `shardId`) {
		shardID = message.data.shardId;
	}

	// Direct donator scores
	if (message.data.shardId == 0) {
		// DonatorScores();
		// setInterval(DonatorScores, 1000 * 60);
	}
});

// server.listen(port, () => console.log(`Listening on port ${port}`));
