// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const canvas = require(`canvas`);
const fetch = require(`node-fetch`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamNames = require(`../assets/teams/names.json`);
const names = {
    nba: require(`../assets/players/nba/names.json`),
    bdl: require(`../assets/players/bdl/names.json`),
    all: require(`../assets/players/all/names.json`)
};
const ids = {
    nba: require(`../assets/players/nba/ids.json`),
    bdl: require(`../assets/players/bdl/ids.json`),
    all: require(`../assets/players/all/ids.json`)
};
const lastPlayed = {
    nba: require(`../assets/players/nba/last-played.json`),
    bdl: require(`../assets/players/bdl/last-played.json`),
};

// Methods
const formatPlayer = require(`../methods/format-player2.js`);
const getJSON = require('../methods/get-json.js');
const formatSeason = require(`../methods/format-season.js`);
const randInt = require(`../methods/randint.js`);
const randint = require('../methods/randint.js');
const query = require(`../methods/database/query.js`);

async function getNewAPI(url) {
    return new Promise(resolve => {
        fetch(url, {
            headers: require(`../config.json`).headers
        }).then(async res => {
            let a = await res.text();
            try {
                a = JSON.parse(a);
            } catch (e) {
                console.log(a);
                resolve(null);
            }
            resolve(a);
        });
    });
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('player-stats')
		.setDescription(`Get a player's stats from any season after 1979-80.`)
        .addStringOption(option => option.setName(`name`).setDescription(`Player name`).setRequired(true).setAutocomplete(true))
        .addStringOption(option => option.setName(`season`).setDescription(`An NBA season, e.g. 2019-2020, 2019-20, or 2019.`))
        .addStringOption(option => option.setName(`mode`).setDescription(`Regular/career/playoffs`).addChoices({
            name: `Regular Season`,
            value: `regular`
        }).addChoices({
            name: `Career`,
            value: `career`
        }).addChoices({
            name: `Playoffs`,
            value: `playoffs`
        }))
        .addBooleanOption(option => option.setName(`advanced`).setDescription(`Whether you want advanced player statistics`)),

    async autocomplete(variables) {
        let { interaction } = variables;

        const focusedValue = interaction.options.getFocused();
        const choices = Object.values(names.all);
        const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase())).slice(0, 25);
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    },

    async execute(variables) {
		let { interaction, ad, con } = variables;

        await interaction.deferReply();

        // Interaction options
        let requestedName = interaction.options.getString(`name`),
            requestedSeason = interaction.options.getString(`season`),
            requestedMode = interaction.options.getString(`mode`),
            useAdvanced = interaction.options.getBoolean(`advanced`);

        // Getting today.json
        delete require.cache[require.resolve(`../cache/today.json`)];
        let today = require(`../cache/today.json`);

        // Validating season
        if (requestedSeason) {
            season = formatSeason(requestedSeason);
            if (!season) return interaction.editReply(`Please use a valid season, e.g. 2019 for 2019-2020.`);
        }

        // Validating mode
        if (!requestedMode) {
            mode = `regular`;
        } else {
            if ([`r`, `reg`, `regular`].includes(requestedMode.toLowerCase())) {
                mode = `regular`;
            } else if ([`c`, `career`].includes(requestedMode.toLowerCase())) {
                mode = `career`;
            } else if ([`p`, `playoff`, `playoffs`].includes(requestedMode.toLowerCase())) {
                mode = `playoffs`;
            } 
        }

        // Core variables
        let possible = {}, found = false;
        let details = { source: null, id: null, name: null };
        let namesAlreadyPushed = [];

        if (ids.all[requestedName.toLowerCase()] && !found) {
            possible[ids.all[requestedName.toLowerCase()]] = requestedName.length;
            found = true;
        }

        if (!found) {
            // Now doing full search since no exact player found at first
            nameLoop: for (var name in ids.all) {
                if (namesAlreadyPushed.includes(name)) continue nameLoop;
                let names = name.split(` `);
                for (var i = 0; i < names.length; i++) {
                    let requests = requestedName.toLowerCase().split(` `);
                    if (requests.includes(names[i].toLowerCase())) {
                        if (!possible[ids.all[name].toString()]) possible[ids.all[name].toString()] = 1;
                        else possible[ids[name].toString()]++;
                        namesAlreadyPushed.push(name);
                    }
                }
            }
        }

        if (Object.keys(possible).length == 1) details = { source: null, id: Object.keys(possible)[0], name: names.all[Object.keys(possible)[0]] };
        else if (!found) { // Must be more than one possibility
            // Seeing if one is more than the others
            let scores = Object.values(possible);
            let top = 0, count = 0, location = [];
            for (var i = 0; i < scores.length; i++) {
                if (scores[i] > top) {
                    top = scores[i];
                    count = 1;
                    location = [null, i];
                } else if (scores[i] == top) {
                    count++;
                }
            }

            if (count > 1 || top == 0 || !location) { // Uncertain
                let embed = new Discord.MessageEmbed()
                    .setTitle(`No specific player was found`)
                    .setDescription(`Request: \`${requestedName}\``)
                    .setColor(teamColors.NBA);

                if (Object.keys(possible).length > 0) {
                    let str1 = `Possible players:`;
                    let str2 = ``;
                    for (var i = 0; i < Object.keys(possible).length; i++) {
                        str2 += `\`${names.all[Object.keys(possible)[i]]}\` `;
                    }
                    embed.addField(str1, str2);
                }

                return interaction.editReply({ embeds: [embed] });
            }

            // Found a certain possibility
            details = { source: null, id: Object.keys(possible)[location[1]], name: names.all[Object.keys(possible)[location[1]]] };
        }

        let url = `https://stats.nba.com/stats/playerprofilev2?LeagueID=&PerMode=PerGame&PlayerID=${details.id}`;

        async function getPlayerStats(update, season, currentInteraction) {
            let p, color = teamColors.NBA, previous, next;

            let json = await getNewAPI(url);

            if (!json) {
                if (update) await currentInteraction.update(`An error occurred fetching those statistics. [Code: F7]`);
                else await currentInteraction.editReply(`An error occurred fetching those statistics. [Code: F7]`);
            } else {
                // If no season specified, make it most recent for that mode
                if (!season) {
                    switch (mode) {
                        case `regular`:
                            season = json.resultSets[0].rowSet[json.resultSets[0].rowSet.length - 1][1].split(`-`)[0];
                            break;

                        case `career`:
                            season = json.resultSets[1].rowSet[json.resultSets[1].rowSet.length - 1][1].split(`-`)[0];
                            break;

                        case `playoffs`:
                            season = json.resultSets[2].rowSet[json.resultSets[2].rowSet.length - 1][1].split(`-`)[0];
                            break;
                    }
                }

                if (mode == `regular`) {
                    let seasons = json.resultSets[0].rowSet;
                    for (var i = 0; i < seasons.length; i++) {
                        if (season.toString() == seasons[i][1].split(`-`)[0]) {
                            p = seasons[i];
                            if (seasons[i - 1]) previous = seasons[i - 1][1];
                            if (seasons[i + 1]) next = seasons[i + 1][1];

                            // Getting team color
                            if (p[3]) color = teamColors[teamNames[p[3]]]; 
                            break;
                        }
                    }
                } else if (mode == `career`) {
                    p = json.resultSets[1].rowSet[0];

                    // Using latest team colour
                    color = teamColors[teamNames[json.resultSets[0].rowSet[json.resultSets[0].rowSet.length - 1][3]]];
                } else if (mode == `playoffs`) {
                    let playoffStatsExist = true;
                    if (!json.resultSets[2]) playoffStatsExist = false;
                    else if (!json.resultSets[2].rowSet) playoffStatsExist = false;
                    else if (json.resultSets[2].rowSet.length == 0) playoffStatsExist = false;
                    if (!playoffStatsExist) return await interaction.editReply(`\`${details.name}\` has not played in the playoffs yet.`);

                    p = json.resultSets[2];
                    let foundSeason = false;
                    seasonLoop: for (var i = 0; i < p.rowSet.length; i++) {
                        if (season.toString() == p.rowSet[i][1].split(`-`)[0] || (!requestedSeason && i == p.rowSet.length - 1)) {
                            if (!requestedSeason) season = parseInt(p.rowSet[i][1].split(`-`)[0]);
                            foundSeason = true;
                            if (p.rowSet[i - 1]) previous = p.rowSet[i - 1][1];
                            if (p.rowSet[i + 1]) next = p.rowSet[i + 1][1];
                            p = p.rowSet[i];

                            color = teamColors[teamNames[p[3]]];
                            break seasonLoop;
                        }
                    }

                    if (!foundSeason) return await interaction.editReply(`Could not find playoff stats for \`${details.name}\` in the \`${season}-${parseInt(season + 1)}\` season.`);
                }

                // Remapping everything to fit
                let temp = {};
                let keys = [`g`, `gamesPlayed`, `gamesStarted`, `mpg`, `fgp`, `ftp`, `tpp`, `rpg`, `apg`, `spg`, `bpg`, `turnovers`, `pFouls`, `ppg`, `points`, `fgm`, `tpm`, `fga`, `tpa`, `fta`, `ftm`, `offReb`, `defReb`];
                let values = [6,  6,              7,              8,     11,   17,     14,    20,    21,    22,    23,      24,          25,     26,     26,       9,    12,    10,    13,    16,    15,     18,       19];
                let valuesCareer = [3, 3,           4,            5,     8,    14,     11,    17,   18,     19,    20,      21,          22,     23,     23,      6,     9,     7,     10,    13,    12,     15,       16];
                for (var i = 0; i < keys.length; i++) {
                    temp[keys[i]] = parseFloat((mode == `career`) ? p[valuesCareer[i]] : p[values[i]]);
                    if ([`fgp`, `ftp`, `tpp`].includes(keys[i])) temp[keys[i]] = parseFloat(100 * temp[keys[i]]).toFixed(1);
                }
                p = temp;
            }

            // Error catching
            if (!p) return await interaction.editReply(`${season}-${season + 1} ${mode} stats could not be found for ${details.name}. [2]`);
            if (!p.gamesPlayed) return await interaction.editReply(`${season}-${season + 1} ${mode} stats could not be found for ${details.name}. [3]`);

            // Calculated stats
            p.g = p.gamesPlayed;
            let _2pp = (((p.fgm - p.tpm) / (p.fga - p.tpa)) * 100).toPrecision(3),
                _efgp = (((p.fgm + (0.5 * p.tpm)) / p.fga) * 100).toPrecision(3),
                _tsp = ((p.points / (2 * (p.fga + (0.44 * p.fta)))) * 100).toPrecision(3),
                _tovp = ((p.turnovers / (p.fga + p.turnovers + (0.44 * p.fta))) * 100).toPrecision(3),
                _gmsc = p.ppg + (0.4 * (p.fgm)) - (0.7 * (p.fga)) - (0.4 * ((p.fta) - (p.ftm))) + (0.7 * (p.offReb)) + (0.3 * (p.defReb)) + p.spg + (0.7 * p.apg) + (0.7 * p.bpg) - (0.4 * (p.pFouls)) - (p.turnovers);

            // Getting advanced stats if needed
            let advancedData = {};
            if (mode != `career` && useAdvanced) {
                let advanced = await getNewAPI(`https://stats.nba.com/stats/playerdashboardbygeneralsplits?DateFrom=&DateTo=&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerID=${details.id}&PlusMinus=N&Rank=N&Season=${season}-${(parseInt(season) + 1).toString().substring(2, 4)}&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&Split=general&VsConference=&VsDivision=`);
                let datas = [`NET_RATING`, `AST_PCT`, `AST_TO`, `USG_PCT`, `PACE`, `PIE`];
                let locations = {};

                advanced = advanced.resultSets[0];
                for (var i = 0; i < advanced.headers.length; i++) {
                    if (datas.includes(advanced.headers[i])) {
                        locations[advanced.headers[i]] = i;
                    }
                }

                let stats = advanced.rowSet[0];
                for (var key in locations) {
                    advancedData[key] = stats[locations[key]];
                }
            }

            // Deciding whether the user wants an embed or canvas
            let user = await query(con, `SELECT * FROM users WHERE ID = "${currentInteraction.user.id}";`);
            user = user[0];
            let image = (user.StatsChoice == `i`);

            let embed, img;
            if (image) {
                // Setting up the canvas
                const width = 800, height = ((Object.keys(advancedData).length > 0) ? 390 : 320);
                const c = canvas.createCanvas(width, height);
                const x = c.getContext(`2d`);

                canvas.registerFont(`./assets/fonts/whitney-500.ttf`, {family: `WhitneyLight`});
                canvas.registerFont(`./assets/fonts/whitney-700.ttf`, {family: `WhitneyBold`});
                
                // Background
                x.fillStyle = "#2F3136";
                x.fillRect(0, 0, width, height);

                // Text
                x.fillStyle = "#FFFFFF";
                x.font = `45px WhitneyBold`;
                x.fillText(details.name, 10, 50);

                // x.measureText(playername).width is key here, it measures the width of the string and then uses it to space out the second part of the code.

                // let detailText = `${season}-${((parseInt(season) + 1).toString().substring(2, 4)) < 10) ? `0${(parseInt(season) + 1).toString().substring(2, 4))}` : (parseInt(season) + 1).toString().substring(2, 4))} ${mode[0].toUpperCase()}${mode.substring(1, mode.length)} Stats:`;
                let modeText = (mode == `regular`) ? `Regular Season` : `${mode[0].toUpperCase()}${mode.substring(1, mode.length)}`;
                let detailText = `${season}-${((parseInt(season) + 1) < 10) ? `0${(parseInt(season) + 1).toString().substring(2, 4)}` : (parseInt(season) + 1).toString().substring(2, 4)} ${modeText} Stats:`;

                // More
                x.font = `25px WhitneyLight`;
                x.fillStyle = "#72767d";
                x.fillText(detailText, 10, 80);
                x.fillText(`nbabot.js.org`, 652, (useAdvanced && Object.keys(advancedData).length > 0) ? 375 : 300);
                x.fillRect(0, 90, width, 5);

                x.font = `25px WhitneyBold`;
                x.fillStyle = /*`#E56020`*/ /*color*/ teamColors.NBA;
                x.fillText(`PPG`, 15, 130);
                x.fillText(`RPG`, 105, 130);
                x.fillText(`APG`, 200, 130);
                x.fillText(`BPG`, 300, 130);
                x.fillText(`SPG`, 395, 130);
                x.fillText(`FPG`, 490, 130);
                x.fillText(`TOPG`, 585, 130);
                x.fillText(`MPG`, 685, 130);

                x.font = `20px WhitneyLight`;
                x.fillStyle = `#FFFFFF`;
                x.fillText(p.ppg, 15, 160);
                x.fillText(p.rpg, 110, 160);
                x.fillText(p.apg, 205, 160);
                x.fillText(p.bpg, 300, 160);
                x.fillText(p.spg, 400, 160);
                x.fillText((p.pFouls).toFixed(1), 495, 160);
                x.fillText((p.turnovers).toFixed(1), 590, 160);
                x.fillText(p.mpg, 685, 160);

                x.font = `25px WhitneyBold`;
                x.fillStyle = /*`#E56020`*/ /*color*/ teamColors.NBA;
                x.fillText(`FG%`, 15, 200);
                x.fillText(`FT%`, 105, 200);
                x.fillText(`2P%`, 200, 200);
                x.fillText(`3P%`, 295, 200);
                x.fillText(`eFG%`, 390, 200);
                x.fillText(`TS%`, 500, 200);
                x.fillText(`TOV%`, 595, 200);
                x.fillText(`GP`, 685, 200);

                x.font = `20px WhitneyLight`;
                x.fillStyle = `#FFFFFF`;
                x.fillText(p.fgp, 15, 230);
                x.fillText(p.ftp, 105, 230);
                x.fillText(_2pp, 200, 230);
                x.fillText(p.tpp, 295, 230);
                x.fillText(_efgp, 390, 230);
                x.fillText(_tsp, 500, 230);
                x.fillText(_tovp, 595, 230);
                x.fillText(p.g, 685, 230);

                if (Object.keys(advancedData).length > 0) {
                    x.font = `25px WhitneyBold`;
                    x.fillStyle = teamColors.NBA;
                    x.fillText(`NET Rating`, 355, 270);
                    x.fillText(`AST%`, 530, 270);
                    x.fillText(`AST/TO`, 660, 270);
                    x.fillText(`USG%`, 15, 340);
                    x.fillText(`PACE`, 200, 340);
                    x.fillText(`PIE`, 390, 340);

                    x.font = `20px WhitneyLight`;
                    x.fillStyle = `#FFFFFF`;
                    x.fillText(advancedData[`NET_RATING`], 390, 300);
                    x.fillText((parseFloat(advancedData[`AST_PCT`]) * 100).toFixed(1), 550, 300);
                    x.fillText(advancedData[`AST_TO`], 685, 300);
                    x.fillText((parseFloat(advancedData[`USG_PCT`]) * 100).toFixed(1), 15, 370);
                    x.fillText(advancedData[`PACE`], 205, 370);
                    x.fillText((parseFloat(advancedData[`PIE`]) * 100).toFixed(1), 395, 370);
                }

                // Headshot? https://cdn.nba.com/headshots/nba/latest/1040x760/${ID}.png
                let headshot = await canvas.loadImage(`https://cdn.nba.com/headshots/nba/latest/1040x760/${details.id}.png`);
                x.drawImage(headshot, 685, 5, 110, 80);

                x.font = `25px WhitneyBold`;
                x.fillStyle = teamColors.NBA;
                x.fillText(`G Started`, 15, 270);
                x.fillText(`Average GmSc`, 160, 270);

                x.font = `20px WhitneyLight`;
                x.fillStyle = `#FFFFFF`;
                x.fillText(p.gamesStarted, 15, 300);
                x.fillText(_gmsc.toFixed(1), 200, 300);

                let fileName = `${details.name.split(` `).join(`-`)}-${season}.png`;
                img = new Discord.MessageAttachment(c.toBuffer(), fileName);

                embed = new Discord.MessageEmbed()
                    .setColor(color)
                    .setImage(`attachment://${fileName}`);
    
            } else { // Normal embed
                // Getting headshot
                let headshot = `https://cdn.nba.com/headshots/nba/latest/1040x760/${details.id}.png`;

                let modeText = (mode == `regular`) ? `Regular Season` : `${mode[0].toUpperCase()}${mode.substring(1, mode.length)}`;
                let detailText = `${season}-${((parseInt(season) + 1) < 10) ? `0${(parseInt(season) + 1).toString().substring(2, 4)}` : (parseInt(season) + 1).toString().substring(2, 4)} ${modeText} Stats for ${details.name}:`;

                embed = new Discord.MessageEmbed()
                    .setTitle(`__${detailText}__`)
                    .setFooter({ text: `Note: you can change the stat format between embed and image with /settings stats-format.` })
                    .setColor(color);

                if (headshot) embed.setThumbnail(headshot);

                // Adding stats to embed
                let d = (details.source == `nba`)
                embed.addField(`PPG`, `\`${p.ppg}\``, true);
                embed.addField(`RPG`, `\`${p.rpg}\``, true);
                embed.addField(`APG`, `\`${p.apg}\``, true);
                embed.addField(`SPG`, `\`${p.spg}\``, true);
                embed.addField(`BPG`, `\`${p.bpg}\``, true);
                embed.addField(`PF`,  `\`${(p.pFouls).toFixed(1)}\``, true);
                embed.addField(`TOPG`,`\`${(p.turnovers).toFixed(1)}\``, true);
                embed.addField(`MPG`, `\`${p.mpg}\``, true);
                embed.addField(`TOV%`, `\`${_tovp}\``, true);
                embed.addField(`FG%`, `\`${p.fgp}\``, true);
                embed.addField(`3P%`, `\`${p.tpp}\``, true);
                embed.addField(`FT%`, `\`${p.ftp}\``, true);
                embed.addField(`2P%`, `\`${_2pp}\``, true);
                embed.addField(`EFG%`, `\`${_efgp}\``, true);
                embed.addField(`TS%`, `\`${_tsp}\``, true);
                embed.addField(`GP`, `\`${p.g}\``, true);
                embed.addField(`GS`, `\`${p.gamesStarted}\``, true);
                embed.addField(`GmSc`, `\`${_gmsc.toFixed(1)}\``, true);

                if (Object.keys(advancedData).length > 0) {
                    embed.addField(`NET Rating`, `\`${advancedData[`NET_RATING`]}\``, true);
                    embed.addField(`AST%`, `\`${(parseFloat(advancedData[`AST_PCT`]) * 100).toFixed(1)}\``, true);
                    embed.addField(`AST/TO`, `\`${advancedData[`AST_TO`]}\``, true);
                    embed.addField(`USG%`, `\`${(parseFloat(advancedData[`USG_PCT`]) * 100).toFixed(1)}\``, true);
                    embed.addField(`PACE`, `\`${advancedData[`PACE`]}\``, true);
                    embed.addField(`PIE`, `\`${(parseFloat(advancedData[`PIE`]) * 100).toFixed(1)}\``, true);
                }
            }

            let row = null;
            if (mode != `career` && (previous || next) && !useAdvanced) { // Add buttons
                row = new Discord.MessageActionRow();
                if (previous) {
                    row.addComponents(
                        new Discord.MessageButton()
                            .setCustomId(`ps-${previous.split(`-`)[0]}-${details.id}-${mode}`)
                            .setLabel(`← ${previous}`)
                            .setStyle(`PRIMARY`)
                    );   
                }
                row.addComponents(
                    new Discord.MessageButton()
                        .setCustomId(`null`)
                        .setLabel(`${season}-${(parseInt(season) + 1).toString().substring(2, 4)}`)
                        .setStyle(`PRIMARY`)
                        .setDisabled(true)
                );
                if (next) {
                    row.addComponents(
                        new Discord.MessageButton()
                            .setCustomId(`ps-${next.split(`-`)[0]}-${details.id}-${mode}`)
                            .setLabel(`${next} →`)
                            .setStyle(`PRIMARY`)
                    );
                }
            }

            if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });
            
            let package = (row) ? ((image) ? { embeds: [embed], files: [img], components: [row] } : { embeds: [embed], components: [row] }) : ((image) ? { embeds: [embed], files: [img] } : { embeds: [embed] });
            if (update) {
                await currentInteraction.update(package);
            } else {
                await currentInteraction.editReply(package);
            }
        }
    },
};
