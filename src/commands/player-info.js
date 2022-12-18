// https://stats.nba.com/stats/commonplayerinfo?LeagueID=&PlayerID=2544

// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const wiki = require(`wikipedia`);
const fetch = require(`node-fetch`);

const config = require(`../config.json`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamNames = require(`../assets/teams/names.json`);
const names = {
    nba: require(`../assets/players/nba/names.json`),
    bdl: require(`../assets/players/bdl/names.json`),
};
const ids = {
    nba: require(`../assets/players/nba/ids.json`),
    bdl: require(`../assets/players/bdl/ids.json`),
};

// Methods
const searchPlayers = require(`../methods/search-players.js`);
const getJSON = require(`../methods/get-json.js`);
const formatNumber = require(`../methods/format-number.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`player-info`)
		.setDescription(`Get basic info and description for a specific player.`)
        .addStringOption(option => option.setName(`name`).setDescription(`The player's name, e.g. LeBron James.`).setRequired(true).setAutocomplete(true)),

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

        delete require.cache[require.resolve(`../cache/today.json`)];
        let today = require(`../cache/today.json`);

		let requestedName = interaction.options.getString(`name`);
        let name = searchPlayers(requestedName);

        if (!name) {
        	let e = new Discord.MessageEmbed().setTitle(`No specific player was found`).setDescription(`Request: \`${requestedName}\``).setColor(teamColors.NBA);
        	return await interaction.editReply({ embeds: [e] });
        }

        if (!(name instanceof Array)) { // Uncertain
            let embed = new Discord.MessageEmbed()
                .setTitle(`No specific player was found`)
                .setColor(teamColors.NBA);

            for (var key in name) {
                if (Object.keys(name[key]).length > 0) {
                    let str1 = (key == `nba`) ? `Possible players since 2016-17:` : `Possible players before 2016-17:`;
                    let str2 = ``;
                    for (var i = 0; i < Object.keys(name[key]).length; i++) {
                        str2 += `\`${names[key][Object.keys(name[key])[i]]}\` `;
                    }
                    embed.addField(str1, str2);
                }
            }

            return await interaction.editReply({ embeds: [embed] });
        }

        // Found a player
        let playerName = names[name[0]][name[1]];
        let embed = new Discord.MessageEmbed()
            .setTitle(`__Player information for ${playerName}:__`);

        // Adding wikipedia info
        try {
            const page = await wiki.page(names[name[0]][name[1]]);
            const summary = await page.summary();

            embed.setDescription(`${summary.extract.substring(0, 256)}... [Wikipedia](${page.fullurl})`);
            embed.setThumbnail(summary.thumbnail.source);
        } catch (e) {
            console.log(e);
        }

        // Adding other info if from nba API
        if (name[0] == `nba`) {
            let player;
            yearLoop: for (var i = today.seasonScheduleYear; i > 2015; i--) {
                let players = require(`../assets/players/nba/${i}.json`);
                for (var j = 0; j < players.league.standard.length; j++) {
                    if (players.league.standard[j].personId == name[1]) {
                        player = players.league.standard[j];
                        break yearLoop;
                    }
                }
            }

            if (player) {
                // Checking for abnormalities
                let draftStr = "#" + player.draft.pickNum + " (" + player.draft.seasonYear + ")";
                if (draftStr == "# ()") draftStr = "Undrafted";
                if (player.collegeName == "" || player.collegeName == " ") player.collegeName = "Unlisted";
                if (!player.jersey) player.jersey = "Not Specified";

                embed.addField(`Jersey Number`, (player.jersey) ? player.jersey : `Unknown`, true)
                    .addField(`Position`, (player.pos) ? player.pos : `Unknown`, true)
                    .addField(`Height`, `${player.heightFeet}'${player.heightInches}"/${player.heightMeters}m`, true)
                    .addField(`Weight`, `${player.weightPounds}lbs/${player.weightKilograms}kg`, true)
                    .addField(`Date of Birth`, new Date(player.dateOfBirthUTC).toDateString(), true)
                    .addField(`Drafted`, draftStr, true)
                    .addField(`NBA Debut Year`, (player.nbaDebutYear) ? player.nbaDebutYear : `Unknown`, true)
                    .addField(`Country`, (player.country) ? player.country : `Unknown`, true)
                    .setColor(teamColors[teamNames[player.teamId]]);

                // Checking for injuries as well
                let json = await getJSON(`https://www.rotowire.com/basketball/tables/injury-report.php?pos=ALL&team=ALL`);

                let str1 = `Current Injury`, str2 = `None`;
                if (json instanceof Array) {
                    if (json.length > 0) {
                        for (var i = 0; i < json.length; i++) {
                            if (names[name[0]][name[1]].toLowerCase() == json[i].player.toLowerCase()) {
                                str2 = `${json[i].status} - ${json[i].injury}`;
                            }
                        }
                    }
                }
                embed.addField(str1, str2, true);

                let awards = await fetch(`https://stats.nba.com/stats/playerawards?PlayerID=${player.personId}`, {
                    headers: config.headers
                });

                if (awards.ok) {
                    awards = await awards.json();

                    awards = awards.resultSets[0].rowSet;

                    let team = {"All-NBA": [], "All-Defensive Team": [], "All-Rookie Team": []};
                    let award = {"NBA Most Valuable Player": [], "NBA Defensive Player of the Year": [], "NBA Finals Most Valuable Player": [], "NBA Rookie of the Year": []};
                    for (var k = 0; k < awards.length; k++) {
                        if (team[awards[k][4]]) {
                            team[awards[k][4]].push({ team: awards[k][5], season: awards[k][6] });
                        } else if (award[awards[k][4]]) {
                            award[awards[k][4]].push(awards[k][6]);
                        }
                    }

                    let str1t = `__Team Selections  __`, str2t = ``, str1a = `__Awards__`, str2a = ``;

                    typeLoop: for (var type in team) {
                        if (team[type].length == 0) continue typeLoop;
                        
                        str2t += `**${type} (${team[type].length}):** `;

                        let str2tt = [];
                        for (var k = 0; k < team[type].length; k++) {
                            str2tt.push(`${formatNumber(team[type][k].team)} (${team[type][k].season})`);
                        }

                        str2t += str2tt.join(`, `);
                        str2t = `${str2t}\n`;
                    }

                    typeLoop: for (var type in award) {
                        if (award[type].length == 0) continue typeLoop;

                        str2a += `**${type} (${award[type].length}):** ${award[type].join(`, `)}\n`;
                    }

                    if (str2t) embed.addField(str1t, str2t);
                    if (str2a) embed.addField(str1a, str2a);
                }
            } 
        } else embed.setColor(teamColors.NBA);

        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.editReply({ embeds: [embed] });
	},
};
