// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fs = require(`fs`);
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const config = require(`../config.json`);

// Methods
const query = require(`../methods/database/query.js`);
const formatTeam = require(`../methods/format-team.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`settings`)
		.setDescription(`NBABot settings`)
        .addSubcommand(subcommand => 
            subcommand
                .setName(`favourite-team`)
                .setDescription(`Change your favourite team.`)
                .addStringOption(option => option.setName(`team`).setDescription(`An NBA team, e.g. PHX or Lakers.`).setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand
                .setName(`odds-format`)
                .setDescription(`Change whether you want odds as decimal or as a US moneyline.`)
                .addStringOption(option => option.setName(`type`).setDescription(`Either decimal or US.`).addChoices({
                    name: `Decimal`,
                    value: `decimal`
                }).addChoices({
                    name: `US`,
                    value: `us`
                }).setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand
                .setName(`date-format`)
                .setDescription(`Change whether the date format is mm/dd/yyyy (US) or dd/mm/yyyy (International).`)
                .addStringOption(option => option.setName(`format`).setDescription(`Either US (mm/dd/yyyy) or International (dd/mm/yyyy).`).addChoices({
                    name: `US (mm/dd/yyyy)`,
                    value: `us`
                }).addChoices({
                    name: `International (dd/mm/yyyy)`,
                    value: `international`
                }).setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand
                .setName(`ads`)
                .setDescription(`(Donator only) Choose to have ads or not.`)
                .addStringOption(option => option.setName(`choice`).setDescription(`On for ads, Off for no ads`).addChoices({
                    name: `On`,
                    value: `on`
                }).addChoices({
                    name: `Off`,
                    value: `off`
                }).setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand
                .setName(`betting`)
                .setDescription(`Turn on/off all betting functionality.`)
                .addStringOption(option => option.setName(`choice`).setDescription(`On for betting, Off for no betting`).addChoices({
                    name: `On`,
                    value: `on`
                }).addChoices({
                    name: `Off`,
                    value: `off`
                }).setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand
                .setName(`server-betting`)
                .setDescription(`(Manage server permission required) Turn on/off all betting in a server.`)
                .addStringOption(option => option.setName(`choice`).setDescription(`On for betting, Off for no betting`).addChoices({
                    name: `On`,
                    value: `on`
                }).addChoices({
                    name: `Off`,
                    value: `off`
                }).setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand
                .setName(`betting-channel`)
                .setDescription(`(Manage server permission required) Dedicate one channel for betting functionality.`)
                .addChannelOption(option => option.setName(`channel`).setDescription(`Dedicated betting channel. Leave blank to allow betting functionality for the whole server.`)))
        .addSubcommand(subcommand => 
            subcommand
                .setName(`tips`)
                .setDescription(`Turn tips on/off.`)
                .addStringOption(option => option.setName(`choice`).setDescription(`On for tips, Off for no tips.`).addChoices({
                    name: `On`,
                    value: `on`
                }).addChoices({
                    name: `Off`,
                    value: `off`
                }).setRequired(true)))
        .addSubcommand(subcommand => 
            subcommand
                .setName(`stats-format`)
                .setDescription(`Change the format for player-stats between embed and image.`)
                .addStringOption(option => option.setName(`format`).setDescription(`Whether you want it to be in image or embed format.`).addChoices({
                    name: `Embed`,
                    value: `embed`
                }).addChoices({
                    name: `Image`,
                    value: `image`
                }).setRequired(true))),
    
	async execute(variables) {
		let { con, interaction } = variables;

		let subcmd = interaction.options.getSubcommand(); let embed;

        switch (subcmd) {
            case `favourite-team`:
                let team = interaction.options.getString(`team`);
                team = formatTeam(team);
                if (!team) return await interaction.reply(`Please specify a valid team. See all available teams with \`/teams\`.`);

                await query(con, `UPDATE users SET FavouriteTeam = '${team}' WHERE ID = '${interaction.user.id}';`);

                embed = new Discord.MessageEmbed()
                    .setColor(teamColors.NBA)
                    .addField(`Success! Changed your favourite team to \`${team}\`.`, `Use \`/balance\` to see this change.`);

                return await interaction.reply({ embeds: [embed] });
                break;

            case `odds-format`:
                let type = interaction.options.getString(`type`);
                await query(con, `UPDATE users SET Odds = '${type[0].toLowerCase()}' WHERE ID = '${interaction.user.id}';`);

                embed = new Discord.MessageEmbed()
                    .setColor(teamColors.NBA)
                    .addField(`Success! Changed your odds type to \`${type}\`.`, `Use \`/odds\` to see odds for upcoming games.`);
                
                return await interaction.reply({ embeds: [embed] });
                break;

            case `date-format`:
                let format = interaction.options.getString(`format`);
                await query(con, `UPDATE users SET DateFormat = '${format[0].toLowerCase()}' WHERE ID = '${interaction.user.id}';`);

                embed = new Discord.MessageEmbed()
                    .setColor(teamColors.NBA)
                    .addField(`Success! Changed your date format to \`${format}\`.`, `Use commands with dates to try this out.`);

                return await interaction.reply({ embeds: [embed] });
                break;

            case `ads`:
                let user = await query(con, `SELECT * FROM users WHERE ID = "${interaction.user.id}";`);
                user = user[0];
                if (user.Donator != `y` && user.Donator != `f`) return await interaction.reply(`Only donators can choose whether they want ads or not. Learn more with \`/donate\`.`);

                let choice = interaction.options.getString(`choice`);
                await query(con, `UPDATE users SET Ads = "${(choice == `yes` || choice == `on`) ? `y` : `n`}" WHERE ID = "${interaction.user.id}";`);

                embed = new Discord.MessageEmbed()
                    .setColor(teamColors.NBA)
                    .addField(`Success! Changed your ad preference to \`${choice}\`.`, `Use any commands with embeds to see this change.`);

                return await interaction.reply({ embeds: [embed] });
                break;

            case `betting`:
                let choice2 = interaction.options.getString(`choice`);
                await query(con, `UPDATE users SET Betting = "${(choice2 == `on`) ? `y` : `n`}" WHERE ID = "${interaction.user.id}";`);

                embed = new Discord.MessageEmbed()
                    .setColor(teamColors.NBA)
                    .addField(`Success! Changed your betting preference to \`${choice2}\`.`, `Use any commands (now without) betting to see this change.`);

                return await interaction.reply({ embeds: [embed] });
                break;

            case `server-betting`:
                if (!interaction.member.permissions.has(`MANAGE_GUILD`)) return await interaction.reply(`To change this setting, you need the \`MANAGE_SERVER\` permission. Ask someone with this permission to change this.`);   
                let choice3 = interaction.options.getString(`choice`);

                let guild = await query(con, `SELECT * FROM guilds WHERE ID = "${interaction.guild.id}";`), guildExists = true;
                if (!guild) guildExists = false;
                else if (guild.length == 0) guildExists = false;
                if (!guildExists) await query(con, `INSERT INTO guilds VALUES (${interaction.guild.id}, 1, "y");`);

                await query(con, `UPDATE guilds SET Betting = "${(choice3 == `on`) ? `y` : `n`}" WHERE ID = "${interaction.guild.id}";`);

                embed = new Discord.MessageEmbed()
                    .setColor(teamColors.NBA)
                    .addField(`Success! Changed your server's betting preference to ${choice3}.`, `Betting commands have been ${(choice3 == `on`) ? `added to` : `removed from`} this server.`);
                
                const commands = [];
                const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
        
                let { runDatabase } = require(`../bot.js`);
                commandLoop: for (const file of commandFiles) {
                    let databaseInvolvedCommands = [`balance`, `bet`, `bets`, `claim`, `img-add`, `img-delete`, `img`, `imgs`, `leaderboard`, `rbet`, `reset-balance`, `settings`];
                    if (databaseInvolvedCommands.includes(file.split(`.`)[0]) && !runDatabase) continue commandLoop;

                    let bettingCommands = [`balance`, `bet`, `bets`, `claim`, `leaderboard`, `odds`, `rbet`, `reset-balance`, `weekly`];
                    if (choice3 == `off` && bettingCommands.includes(file.split(`.`)[0])) continue commandLoop;

                    const command = require(`./${file}`);
                    commands.push(command.data.toJSON());
                }
        
                const rest = new REST({ version: '9' }).setToken(config.token);
        
                rest.put(Routes.applicationGuildCommands(config.clientId, interaction.guild.id), { body: commands })
                    .then(async () => {
                        console.log(`Successfully registered application commands for guild ${interaction.guild.id}.`);
                        
                        let version = await query(con, `SELECT Version FROM guilds WHERE ID = "current";`);
                        version = version[0].Version;
                        let guild = await query(con, `SELECT * FROM guilds WHERE ID = "${interaction.guild.id}";`), guildExists = true;
                        
                        if (!guild) guildExists = false;
                        else if (guild.length == 0) guildExists = false;
    
                        if (guildExists) {
                            // ...
                        } else {
                            await query(con, `INSERT INTO guilds VALUES ("${interaction.guild.id}", ${version}, "${(choice3 == `on` ? `y` : `n`)}");`);
                        }
                    })
                    .catch(async error => {
                        if (error) {
                            console.log(error);
                        }
                    });

                return await interaction.reply({ embeds: [embed] });
                break;

            case `betting-channel`:
                if (!interaction.member.permissions.has(`MANAGE_GUILD`)) return await interaction.reply(`To change this setting, you need the \`MANAGE_SERVER\` permission. Ask someone with this permission to change this.`);

                let channel = interaction.options.getChannel(`channel`);

                if (!channel) {
                    await query(con, `UPDATE guilds SET BettingChannel = NULL WHERE ID = "${interaction.guild.id}";`);
                    return await interaction.reply(`**Success!** Betting is not enabled for the entire server.`);
                } else {
                    await query(con, `UPDATE guilds SET BettingChannel = "${channel.id}" WHERE ID = "${interaction.guild.id}";`);
                    return await interaction.reply(`**Success!** Betting is now only enabled in <#${channel.id}>.`);
                }
                break;

            case `tips`:
                let choice4 = interaction.options.getString(`choice`);

                if (choice4 == `on`) {
                    await query(con, `UPDATE users SET Hints = "y" WHERE ID = "${interaction.user.id}";`);
                    return await interaction.reply(`**Success!** Tips are now on.`);
                } else {
                    await query(con, `UPDATE users SET Hints = "n" WHERE ID = "${interaction.user.id}";`);
                    return await interaction.reply(`**Success!** Tips are now off.`);
                }
                break;

            case `stats-format`:
                let choice5 = interaction.options.getString(`format`);
                if (choice5 == `embed`) {
                    await query(con, `UPDATE users SET StatsChoice = "e" WHERE ID = "${interaction.user.id}";`);
                    return await interaction.reply(`**Success!** \`/player-stats\` will now be in embed format.`);
                } else {
                    await query(con, `UPDATE users SET StatsChoice = "i" WHERE ID = "${interaction.user.id}";`);
                    return await interaction.reply(`**Success!** \`/player-stats\` will now be in image format.`);
                }
                break;

            default:
                return await interaction.reply(`Please select a valid setting`);
                break;
        }
	},
};
