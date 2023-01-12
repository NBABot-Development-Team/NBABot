// Libraries
const { SlashCommandBuilder } = require(`@discordjs/builders`);
const Discord = require(`discord.js`);
const fs = require(`fs`);
const fetch = require(`node-fetch`);

// Assets
const teamIDs = require(`../assets/teams/ids.json`);
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const formatSeason = require(`../methods/format-season.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`shotchart`)
		.setDescription(`Get a specific player's shotchart for this current season or another specified season.`)
        .addStringOption(option => option.setName(`name`).setDescription(`An NBA player's name, e.g. Luka Doncic.`).setAutocomplete(true).setRequired(true))
        .addStringOption(option => option.setName(`season`).setDescription(`An NBA season, e.g. 2019-2020, 2019-20 or 2019.`)),

    async autocomplete(variables) {
        let { interaction } = variables;

        const focusedValue = interaction.options.getFocused();
        const choices = Object.values(require(`../assets/players/all/names.json`));
        const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue.toLowerCase())).slice(0, 25);

        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    },
    
	async execute(variables) {
		let { interaction, ad } = variables;

        await interaction.deferReply();

        let requestedName = interaction.options.getString(`name`),
            requestedSeason = interaction.options.getString(`season`),
            name, id, season, team, teamID;

        delete require.cache[require.resolve(`../assets/players/all/ids.json`)];
        const playerIDs = require(`../assets/players/all/ids.json`);
        delete require.cache[require.resolve(`../assets/players/all/names.json`)];
        const playerNames = require(`../assets/players/all/names.json`);
        delete require.cache[require.resolve(`../assets/players/all/details.json`)];
        const playerDetails = require(`../assets/players/all/details.json`);
        delete require.cache[require.resolve(`../cache/today.json`)];
        const seasonScheduleYear = require(`../cache/today.json`).seasonScheduleYear;

		// Validating player name    
        if (!playerIDs[requestedName.toLowerCase()]) return await interaction.editReply(`\`${requestedName}\` is not a valid NBA player. Please select from the list that comes up when typing in their name.`);
        id = playerIDs[requestedName.toLowerCase()];
        name = playerNames[id];

        if (requestedSeason) {
            season = formatSeason(requestedSeason);
            if (!season) return await interaction.editReply(`\`${requestedSeason}\` is not a valid NBA season either because it falls outside of the current 1946-${seasonScheduleYear} range or because it is not a number.`);
        }

        let json = await fetch(`https://stats.nba.com/stats/playerprofilev2?LeagueID=&PerMode=PerGame&PlayerID=${id}`, {
            headers: require(`../config.json`).headers
        });

        if (!json.ok) return await interaction.editReply(`Unable to get team information for that player.`);

        json = await json.json();

        let teams = {};
        let seasons = json.resultSets[0].rowSet;
        for (var i = 0; i < seasons.length; i++) {
            if (seasons[i][4] == `TOT`) continue;
            if (!teams[seasons[i][1].split(`-`)[0]]) teams[seasons[i][1].split(`-`)[0]] = [];
            teams[seasons[i][1].split(`-`)[0]].push(seasons[i][4]);
        }
        playerDetails[id].teams = teams;

        if (!season) season = seasons[seasons.length - 1][1].split(`-`)[0];

        team = playerDetails[id].teams[season];
        teamID = [];

        if (!team) return await interaction.editReply(`An error occurred finding information for that player.`);
        
        for (var i = 0; i < team.length; i++) {
            teamID.push(teamIDs[team[i]]);
        }

        if (!team && !teamID) return await interaction.editReply(`Could not find team for that player.`);

        let embed = new Discord.MessageEmbed()
            .setColor(teamColors[team[0]]);

        let url = `https://stats.nba.com/stats/shotchartdetail?AheadBehind=&ClutchTime=&ContextFilter=&ContextMeasure=FGA&DateFrom=&DateTo=&EndPeriod=&EndRange=&GameID=&GameSegment=&LastNGames=0&LeagueID=00&Location=&Month=0&OpponentTeamID=0&Outcome=&Period=0&PlayerID=${id}&PlayerPosition=&PointDiff=&Position=&RangeType=&RookieYear=&Season=${season}-${(parseInt(season) + 1).toString().substring(2, 4)}&SeasonSegment=&SeasonType=Regular+Season&StartPeriod=&StartRange=&VsConference=&VsDivision=`; // &TeamID=
        for (var i = 0; i < teamID.length; i++) {
            url += `&TeamID=${teamID[i]}`;
        }

        let shotchart = await require(`../methods/get-shotchart.js`)(url);
        if (shotchart) {
            const fileName = `shotchart-${name.toLowerCase().split(` `).join(`-`)}.png`;
            shotchart = new Discord.MessageAttachment(shotchart, fileName);
            embed.setImage(`attachment://${fileName}`);
        }

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.editReply({ embeds: [embed], files: [shotchart] });
	},
};
