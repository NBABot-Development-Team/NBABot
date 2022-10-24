// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);

// Assets
const teamIDs = require(`../assets/teams/ids.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);
const teamColors = require(`../assets/teams/colors.json`);
const teamNames = require(`../assets/teams/names.json`);

// Methods
const formatTeam = require(`../methods/format-team.js`);
const formatSeason = require(`../methods/format-season.js`);
const formatNumber = require(`../methods/format-number.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`team-stats`)
		.setDescription(`Get basic statistics for an NBA team.`)
        .addStringOption(option => option.setName(`team`).setDescription(`An NBA team, e.g. PHX, Suns or Phoenix.`).setRequired(true))
        .addStringOption(option => option.setName(`season`).setDescription(`An NBA season, e.g. 2019-2020, 2019-20, or 2019.`)),
    
	async execute(variables) {
		let { interaction } = variables;

		let team = interaction.options.getString(`team`);
        let season = interaction.options.getString(`season`);

        if (!team) return await interaction.reply(`Please specify an NBA team. Use \`/teams\` for more info.`);
        team = formatTeam(team);
        if (!team) return await interaction.reply(`Please specify a valid NBA team. Use \`/teams\` for more info.`);

        if (!season) {
            delete require.cache[require.resolve(`../cache/today.json`)];
            season = require(`../cache/today.json`).seasonScheduleYear;
        } else {
            season = formatSeason(season);
            if (!season) return await interaction.reply(`Please specify a valid NBA season, e.g. 2019-2020, 2019-20, or 2019.`);
        }

        await interaction.deferReply();

        fetch(`https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}-${(season + 1).toString().substring(2, 4)}&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`, {
            headers: require(`../config.json`).headers
        })
            .then(async res => {
                let json = await res.text();
                json = JSON.parse(json);

                json = json.resultSets[0];
                let teams = json.rowSet;

                for (var i = 0; i < teams.length; i++) {
                    if (teams[i][0].toString() == teamIDs[team]) { // Found team
                        let team = teams[i];
                        let embed = new Discord.MessageEmbed()
                            .setTitle(`__${season}-${season + 1} Team statistics for the ${teamEmojis[teamNames[team[0]]]} ${teamNicknames[teamNames[team[0]]]}:__`)
                            .setColor(teamColors[teamNames[team[0]]])
                            .addField(`Record`, `${team[3]}-${team[4]} ${team[5]}`, true)
                            .addField(`PTS`, `${team[26]} (${formatNumber(team[52])})`, true)
                            .addField(`REB`, `${team[18]} (${formatNumber(team[44])})`, true)
                            .addField(`AST`, `${team[19]} (${formatNumber(team[45])})`, true)
                            .addField(`BLK`, `${team[22]} (${formatNumber(team[48])})`, true)
                            .addField(`STL`, `${team[21]} (${formatNumber(team[47])})`, true)
                            .addField(`PF`, `${team[24]} (${formatNumber(team[50])})`, true)
                            .addField(`TOV`, `${team[20]} (${formatNumber(team[46])})`, true)
                            .addField(`BLK`, `${team[22]} (${formatNumber(team[48])})`, true)
                            .addField(`FGM`, `${team[7]} (${formatNumber(team[33])})`, true)
                            .addField(`FGA`, `${team[8]} (${formatNumber(team[34])})`, true)
                            .addField(`FG%`, `${team[9]} (${formatNumber(team[35])})`, true)
                            .addField(`FTM`, `${team[13]} (${formatNumber(team[39])})`, true)
                            .addField(`FTA`, `${team[14]} (${formatNumber(team[40])})`, true)
                            .addField(`FT%`, `${team[15]} (${formatNumber(team[41])})`, true)
                            .addField(`3PM`, `${team[10]} (${formatNumber(team[36])})`, true)
                            .addField(`3PA`, `${team[11]} (${formatNumber(team[37])})`, true)
                            .addField(`3P%`, `${team[12]} (${formatNumber(team[38])})`, true);

                        return await interaction.editReply({ embeds: [embed] });
                    }
                }

                return await interaction.editReply(`Team could not be found. Use /teams for more info.`);
            });
	},
};
