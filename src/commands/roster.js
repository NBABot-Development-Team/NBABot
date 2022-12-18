/* Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamIds = require(`../assets/teams/ids.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);
const teamColors = require(`../assets/teams/colors.json`);
const teamLogos = require(`../assets/teams/logos.json`);

// Methods
const formatTeam = require(`../methods/format-team.js`);
const formatSeason = require('../methods/format-season.js');
const getJSON = require(`../methods/get-json.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('roster')
		.setDescription(`Get a team's roster from a certain season.`)
        .addStringOption(option => option.setName(`team`).setDescription(`A team, e.g. LAL or Lakers.`).setRequired(true))
        .addStringOption(option => option.setName(`season`).setDescription(`A specified season, e.g. 2019-20.`)),
    
	async execute(variables) {
		let { interaction, ad } = variables;

        // Getting today.json
        delete require.cache[require.resolve(`../cache/today.json`)];
        let today = require(`../cache/today.json`);

        // Validating the team
        let team = interaction.options.getString(`team`);
        team = formatTeam(team);
        if (!team) return await interaction.reply(`Please use a valid team, e.g. LAL or Lakers. Check \`/teams\` for more info.`);

        // Validating the season
        let season = interaction.options.getString(`season`);
        if (!season) {
            season = today.seasonScheduleYear;
        } else {
            season = formatSeason(season);
            if (!season) return await interaction.reply(`Please use a valid season, e.g. 2019-20 or 2017-2018.`);
        }

        if (season < 2016) return await interaction.reply(`Unfortunately team rosters are not available before the 2016-2017 season.`);

        let id = teamIds[team];

        let json = await getJSON(`http://data.nba.net/10s/prod/v1/${season}/teams/${id}/roster.json`)
	
        let embed = new Discord.MessageEmbed()
            .setTitle(`Roster for the ${season}-${season + 1} ${teamNicknames[team]}`)
            .setColor(teamColors[team])
            .setThumbnail(teamLogos[team]);

        let description = ``;
        let players = require(`../assets/players/nba/${season}.json`);
        let ids = [];

        for (var i = 0; i < json.league.standard.players.length; i++) {
            for (var player of players.league.standard) {
                if (player.personId == json.league.standard.players[i].personId && !ids.includes(player.personId)) {
                    if (!player.jersey) player.jersey = `?`;
                    if (player.jersey.toString().length == 1) player.jersey = `${player.jersey} `;
                    player.pos = player.pos.split(`-`).join(`/`);
                    if (player.pos.length == 1) player.pos = ` ${player.pos} `;
                    description += `\`#${player.jersey} ${player.pos}\` - ${player.firstName} ${player.lastName}\n`;
                    ids.push(player.personId);
                }
            }
        }

        embed.setDescription(description);
        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });
        return await interaction.reply({ embeds: [embed] });
    },
};*/

// Libraries
const { SlashCommandBuilder } = require(`@discordjs/builders`);
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);

// Assets
const teamIDs = require(`../assets/teams/ids.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);
const teamColors = require(`../assets/teams/colors.json`);
const teamLogos = require(`../assets/teams/logos.json`);

// Methods
const formatTeam = require(`../methods/format-team.js`);
const formatSeason = require(`../methods/format-season.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`roster`)
		.setDescription(`Get the roster of a specific team for this season or for another specified season.`)
        .addStringOption(option => option.setName(`team`).setDescription(`An NBA team, e.g. LAL or Lakers.`).setRequired(true))
        .addStringOption(option => option.setName(`season`).setDescription(`An NBA season, e.g. 2019-2020, 2019-20, or 2019.`)),
    
	async execute(variables) {
		let { interaction, ad } = variables;

        await interaction.deferReply();

		// Validating team and/or season
        let team, season;
        let requestedTeam = interaction.options.getString(`team`);
        team = formatTeam(requestedTeam);
        if (!team) return await interaction.editReply(`\`${requestedTeam}\` is not a valid NBA team. Use \`/teams\` for more information.`);
        let requestedSeason = interaction.options.getString(`season`);
        if (requestedSeason) {
            season = formatSeason(requestedSeason);
            if (!season) return await interaction.editReply(`\`\` is not a valid NBA season. A correct NBA season would be \`2019-2020\`, \`2019-20\`, or \`2019\`.`);
        } else {
            delete require.cache[require.resolve(`../cache/today.json`)];
            season = require(`../cache/today.json`).seasonScheduleYear;
        }

        let json = await fetch(`https://stats.nba.com/stats/commonteamroster?LeagueID=&Season=${season}-${(parseInt(season) + 1).toString().substring(2, 4)}&TeamID=${teamIDs[team]}`, {
            headers: require(`../config.json`).headers
        });

        if (!json.ok) return await interaction.editReply(`An error occurred fetching the information.`);
        json = await json.json();
        if (!json) return await interaction.editReply(`An error occurred fetching the information.`);

        let embed = new Discord.MessageEmbed()
            .setTitle(`__Roster for the ${season}-${season + 1} ${teamNicknames[team]}:__`)
            .setColor(teamColors[team])
            .setThumbnail(teamLogos[team]);

        let players = json.resultSets[0].rowSet;
        let coaches = json.resultSets[1].rowSet;

        let playerString = ``, coachString = ``;

        for (var i = 0; i < players.length; i++) {
            let player = {
                jersey: players[i][6],
                pos: players[i][7],
                name: players[i][3]
            };

            if (player.jersey.toString().length == 1) player.jersey = `${player.jersey} `;
            player.pos = player.pos.split(`-`).join(`/`);
            if (player.pos.length == 1) player.pos = ` ${player.pos} `;
            playerString += `\`#${player.jersey} ${player.pos}\` - ${player.name}\n`;
        }
        embed.addField(`Players`, playerString);

        for (var i = 0; i < coaches.length; i++) {
            coachString += `${coaches[i][7]} - ${coaches[i][5]}\n`;
        }
        if (coachString.length > 0) embed.addField(`Coaches`, coachString);

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });
        return await interaction.editReply({ embeds: [embed] });
	},
};

