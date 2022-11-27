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
};
const ids = {
    nba: require(`../assets/players/nba/ids.json`),
    bdl: require(`../assets/players/bdl/ids.json`),
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

module.exports = {
	data: new SlashCommandBuilder()
		.setName('player-stats')
		.setDescription(`Get a player's stats from any season after 1979-80.`)
        .addStringOption(option => option.setName(`name`).setDescription(`Player name`).setRequired(true))
        .addStringOption(option => option.setName(`season`).setDescription(`Season, e.g. 2019 for 2019-2020.`))
        .addStringOption(option => option.setName(`mode`).setDescription(`Regular/career/playoffs`).addChoices({
            name: `Regular Season`,
            value: `regular`
        }).addChoices({
            name: `Career`,
            value: `career`
        }).addChoices({
            name: `Playoffs`,
            value: `playoffs`
        })),
    
	async execute(variables) {
		let { interaction, ad, con } = variables;

        await interaction.deferReply();

        // Interaction options
        let requestedName = interaction.options.getString(`name`),
            requestedSeason = interaction.options.getString(`season`),
            requestedMode = interaction.options.getString(`mode`),
            season, mode, switchedToRegularSeason = false, useNewAPI = false;

        // Getting today.json
        delete require.cache[require.resolve(`../cache/today.json`)];
        let today = require(`../cache/today.json`);

        // Validating season
        if (requestedSeason) {
            season = formatSeason(requestedSeason);
            if (!season) return interaction.editReply(`Please use a valid season, e.g. 2019 for 2019-2020.`);
            if (season == 2022) useNewAPI = true;
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

        // Validating player
        let possible = { nba: {}, bdl: {} }, found = false;
        let details = { source: null, id: null, name: null };
        let namesAlreadyPushed = [];

        // Random player
        if ([`random`, `rand`, `randm`].includes(requestedName.toLowerCase())) {
            let coin = randInt(1, 2);
            
            let allowedToUseNba = true;
            if (coin == 1) allowedToUseNba = true;
            else if (season) {
                if (season < 2016) allowedToUseNba = false;
            } else if (coin == 2) allowedToUseNba = false;

            if (allowedToUseNba) { // nba random
                if (!season) {
                    let n = randInt(0, Object.values(ids.nba).length - 1);
                    details = { source: `nba`, id: Object.values(ids.nba)[n], name: names.nba[Object.values(ids.nba)[n]] };
                    season = lastPlayed.nba[details.id];
                } else {
                    let players = require(`../assets/players/nba/${season}.json`);
                    players = players.league.standard;
                    let n = randInt(0, players.length - 1);
                    details = { source: `nba`, id: players[n].personId, name: names.nba[players[n].personId] };
                }
            } else { // bdl random
                let n = randInt(0, Object.values(ids.bdl).length - 1);
                details = { source: `bdl`, id: Object.values(ids.bdl)[n], name: names.bdl[Object.values(ids.bdl)[n]] };
                season = lastPlayed.bdl[details.id];
            }

            found = true;
        }

        let allowedToGetFromNBA = true;

        if (season) {
            if (season < 2016) allowedToGetFromNBA = false;
        }

        if (ids.nba[requestedName.toLowerCase()] && !found && allowedToGetFromNBA) {
            possible.nba[ids.nba[requestedName.toLowerCase()]] = requestedName.length;
            if (!season) season = lastPlayed.nba[ids.nba[requestedName.toLowerCase()]];
            found = true;
        }

        if (!found) {
            if (ids.bdl[requestedName.toLowerCase()]) {
                possible.bdl[ids.bdl[requestedName.toLowerCase()]] = requestedName.length;
                if (!season) season = lastPlayed.bdl[ids.bdl[requestedName.toLowerCase()]];
                found = true;
            }
        }

        if (!found) {
            // Now doing full search
            sourceLoop: for (var key in possible) {
                // if (key == `nba`) continue sourceLoop;
                nameLoop: for (var name in ids[key]) {
                    if (namesAlreadyPushed.includes(name)) continue nameLoop;
                    let names = name.split(` `);
                    namesLoop: for (var i = 0; i < names.length; i++) {
                        let requests = requestedName.toLowerCase().split(` `);
                        if (requests.includes(names[i].toLowerCase())) {
                            if (!possible[key][ids[key][name].toString()]) possible[key][ids[key][name].toString()] = 1;
                            else possible[key][ids[key][name].toString()]++;
                            namesAlreadyPushed.push(name);
                        }
                    }
                }
            }
        }

        // Checking if theres a certain player
        if (Object.keys(possible.nba).length == 1 && Object.keys(possible.bdl).length == 0) details = { source: `nba`, id: Object.keys(possible.nba)[0], name: names.nba[Object.keys(possible.nba)[0]] };
        else if (Object.keys(possible.nba).length == 0 && Object.keys(possible.bdl).length == 1) details = { source: `bdl`, id: Object.keys(possible.bdl)[0], name: names.bdl[Object.keys(possible.bdl)[0]] };
        else if (!found) { // More than one possibility
            // Seeing if one is more than the others
            let scores = { nba: Object.values(possible.nba), bdl: Object.values(possible.bdl) };
            let top = 0, count = 0, location = [];
            for (var key in scores) {
                for (var i = 0; i < scores[key].length; i++) {
                    if (scores[key][i] > top) {
                        top = scores[key][i];
                        count = 1;
                        location = [key, i];
                    } else if (scores[key][i] == top) {
                        count++;
                    }
                }
            }

            if (count > 1 || top == 0 || !location) { // Uncertain
                let embed = new Discord.MessageEmbed()
                    .setTitle(`No specific player was found`)
                    .setDescription(`Request: \`${requestedName}\``)
                    .setColor(teamColors.NBA);

                for (var key in possible) {
                    if (Object.keys(possible[key]).length > 0) {
                        let str1 = (key == `nba`) ? `Possible players since 2016-17:` : `Possible players before 2016-17:`;
                        let str2 = ``;
                        for (var i = 0; i < Object.keys(possible[key]).length; i++) {
                            str2 += `\`${names[key][Object.keys(possible[key])[i]]}\` `;
                        }
                        embed.addField(str1, str2);
                    }
                }

                return interaction.editReply({ embeds: [embed] });
            }

            // Found a certain possibility
            details = { source: location[0], id: Object.keys(possible[location[0]])[location[1]], name: names[location[0]][Object.keys(possible[location[0]])[location[1]]] };
            if (!season) {
                season = lastPlayed[location[0]][Object.keys(possible[location[0]])[location[1]]];
            }
        }

        if (!season) season = lastPlayed[details.source][details.id];

        // Found a certain player
        let url = (details.source == `nba`) ? `https://stats.nba.com/stats/playerprofilev2?LeagueID=&PerMode=PerGame&PlayerID=${details.id}` : `https://balldontlie.io/api/v1/season_averages?player_ids[]=${details.id}&season=${season}`;

        console.log(url);

        async function getNewAPI(url) {
            return new Promise(resolve => {
                fetch(url, {
                    headers: require(`../config.json`).headers
                }).then(async res => {
                    let a = await res.text();
                    a = JSON.parse(a);
                    resolve(a);
                });
            });
        }

        async function getPlayerStats(update, season, currentInteraction) {
            console.log(`i: ${interaction.id}, c: ${currentInteraction.id}`);
            let p, color = teamColors.NBA, previous, next;

            let json;

            if (details.source == `nba`) {
                json = await getNewAPI(url);
                try {
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

                        /*if (!requestedSeason) {
                            p = p.rowSet[p.rowSet.length - 1];
                            color = teamColors[teamNames[p[3]]];
                            foundSeason = true;
                        }*/

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
                } catch (e) {console.log(e)}
            } else { // Extra remapping for bdl
                json = await getJSON(url);
                if (mode != `regular`) return await interaction.editReply(`Only regular season stats are supported for seasons before 2016-2017.`);

                let statsExist = true;

                if (!json) statsExist = false;
                else if (!json.data) statsExist = false;
                else if (json.data.length == 0) statsExist = false;
                else if (!json.data[0]) statsExist = false;
                else if (!json.data[0].games_played) statsExist = false;

                if (!statsExist) return await interaction.editReply(`${season}-${season + 1} ${mode} stats could not be found for ${details.name}. [1]`);

                p = json.data[0];
            }

            // Error catching
            if (!p) return await interaction.editReply(`${season}-${season + 1} ${mode} stats could not be found for ${details.name}. [2]`);
            if (details.source == `nba` && !p.gamesPlayed) return await interaction.editReply(`${season}-${season + 1} ${mode} stats could not be found for ${details.name}. [3]`);

            // Calculated stats
            let _2pp, _efgp, _tsp, _tovp, _gmsc, _plusMinus;
            p.g = (details.source == `nba`) ? p.gamesPlayed : p.games_played;
            if (details.source == `bdl`) {
                _2pp = ((((p.fgm * p.g) - (p.fg3m * p.g)) / ((p.fga * p.g) - (p.fg3a * p.g))) * 100).toPrecision(3);
                _efgp = ((((p.fgm * p.g) + (0.5 * (p.fg3m * p.g))) / (p.fga * p.g)) * 100).toPrecision(3);
                _tsp = (((p.pts * p.g) / (2 * ((p.fga * p.g) + (0.44 * (p.fta * p.g))))) * 100).toPrecision(3);
                _tovp = (((p.turnover * p.g) / ((p.fga * p.g) + (p.turnover * p.g) + (0.44 * (p.fta * p.g)))) * 100).toPrecision(3);
                _gmsc = p.pts + (0.4 * p.fgm) - (0.7 * (p.fga)) - (0.4 * ((p.fta) - (p.ftm))) + (0.7 * (p.oreb)) + (0.3 * (p.dreb)) + p.stl + (0.7 * p.ast) + (0.7 * p.blk) - (0.4 * (p.pf)) - (p.turnover);
            } else {
                _2pp = (((p.fgm - p.tpm) / (p.fga - p.tpa)) * 100).toPrecision(3);
                _efgp = (((p.fgm + (0.5 * p.tpm)) / p.fga) * 100).toPrecision(3);
                _tsp = ((p.points / (2 * (p.fga + (0.44 * p.fta)))) * 100).toPrecision(3);
                _tovp = ((p.turnovers / (p.fga + p.turnovers + (0.44 * p.fta))) * 100).toPrecision(3);
                _gmsc = p.ppg + (0.4 * (p.fgm /*/ p.g*/)) - (0.7 * (p.fga /*/ p.g*/)) - (0.4 * ((p.fta /*/ p.g*/) - (p.ftm /*/ p.g*/))) + (0.7 * (p.offReb /*/ p.g*/)) + (0.3 * (p.defReb /*/ p.g*/)) + p.spg + (0.7 * p.apg) + (0.7 * p.bpg) - (0.4 * (p.pFouls /*/ p.g*/)) - (p.turnovers /*/ p.g*/);
                // _plusMinus = (parseInt(p.plusMinus) < 0) ? p.plusMinus : `+${p.plusMinus}`;
            }

            // Setting up the canvas
            const width = 800, height = 320;
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
            x.fillRect(0, 90, width, 5);
            x.fillText(`nbabot.js.org`, 650, 300);

            x.font = `25px WhitneyBold`;
            x.fillStyle = /*`#E56020`*/ /*color*/ teamColors.NBA;
            x.fillText(`PPG`, 15, 70  + 60);
            x.fillText(`RPG`, 105, 70  + 60);
            x.fillText(`APG`, 200, 70  + 60);
            x.fillText(`BPG`, 300, 70  + 60);
            x.fillText(`SPG`, 395, 70  + 60);
            x.fillText(`FPG`, 490, 70  + 60);
            x.fillText(`TOPG`, 585, 70  + 60);
            x.fillText(`MPG`, 685, 70  + 60);

            x.font = `20px WhitneyLight`;
            x.fillStyle = `#FFFFFF`;
            x.fillText((details.source == `nba`) ? p.ppg : p.pts, 15, 100  + 60);
            x.fillText((details.source == `nba`) ? p.rpg : p.reb, 110, 100  + 60);
            x.fillText((details.source == `nba`) ? p.apg : p.ast, 205, 100  + 60);
            x.fillText((details.source == `nba`) ? p.bpg : p.blk, 300, 100  + 60);
            x.fillText((details.source == `nba`) ? p.spg : p.stl, 400, 100  + 60);
            x.fillText((details.source == `nba`) ? (p.pFouls).toFixed(1) : p.pf, 495, 100  + 60);
            x.fillText((details.source == `nba`) ? (p.turnovers).toFixed(1) : p.turnover, 590, 100  + 60);
            x.fillText((details.source == `nba`) ? p.mpg : p.min, 685, 100  + 60);

            x.font = `25px WhitneyBold`;
            x.fillStyle = /*`#E56020`*/ /*color*/ teamColors.NBA;
            x.fillText(`FG%`, 15, 140  + 60);
            x.fillText(`FT%`, 105, 140  + 60);
            x.fillText(`2P%`, 200, 140  + 60);
            x.fillText(`3P%`, 295, 140  + 60);
            x.fillText(`eFG%`, 390, 140  + 60);
            x.fillText(`TS%`, 500, 140  + 60);
            x.fillText(`TOV%`, 595, 140  + 60);
            x.fillText(`GP`, 685, 140  + 60);

            x.font = `20px WhitneyLight`;
            x.fillStyle = `#FFFFFF`;
            x.fillText((details.source == `nba`) ? p.fgp : (p.fg_pct * 100).toFixed(1), 15, 170  + 60);
            x.fillText((details.source == `nba`) ? p.ftp : (p.ft_pct * 100).toFixed(1), 105, 170  + 60);
            x.fillText(_2pp, 200, 170  + 60);
            x.fillText((details.source == `nba`) ? p.tpp : (p.fg3_pct * 100).toFixed(1), 295, 170  + 60);
            x.fillText(_efgp, 390, 170  + 60);
            x.fillText(_tsp, 500, 170  + 60);
            x.fillText(_tovp, 595, 170  + 60);
            x.fillText(p.g, 685, 170  + 60);

            // Headshot? https://cdn.nba.com/headshots/nba/latest/1040x760/${ID}.png
            // Trying to find player ID if BDL
            let allIDs = require(`../assets/players/nba/ids2.json`), headshot;
            if (details.source == `bdl` && allIDs[details.name.toLowerCase()]) {
                headshot = `https://cdn.nba.com/headshots/nba/latest/1040x760/${allIDs[details.name.toLowerCase()]}.png`;
            } else if (details.source == `nba`) {
                headshot = `https://cdn.nba.com/headshots/nba/latest/1040x760/${details.id}.png`;
            }
            if (headshot) {
                headshot = await canvas.loadImage(headshot);
                x.drawImage(headshot, 685, 5, 110, 80);
            }

            x.font = `25px WhitneyBold`;
            x.fillStyle = /*`#E56020`; color*/ teamColors.NBA;
            if (details.source == `nba`) {
                x.fillText(`G Started`, 15, 210  + 60);
                x.fillText(`Average GmSc`, 195, 210  + 60);
                // x.fillText(`3 Doubles`, 355, 210  + 60);
                // x.fillText(`Average GmSc`, 540, 210  + 60);
            } else x.fillText(`Average GmSc`, 15, 210  + 60);

            x.font = `20px WhitneyLight`;
            x.fillStyle = `#FFFFFF`;
            if (details.source == `nba`) {
                x.fillText(p.gamesStarted, 15, 240  + 60);
                x.fillText(_gmsc.toFixed(1), 195, 240  + 60);
                // x.fillText(p.td3, 355, 240  + 60);
                // x.fillText(_gmsc.toFixed(1), 540, 240  + 60);
            } else x.fillText(_gmsc.toFixed(1), 15, 240  + 60);

            let fileName = `${details.name.split(` `).join(`-`)}-${season}.png`;
            const img = new Discord.MessageAttachment(c.toBuffer(), fileName);

            let embed = new Discord.MessageEmbed()
                .setColor(color)
                .setImage(`attachment://${fileName}`);

            let row = null;
            if (mode != `career` && (previous || next) && details.source == `nba`) { // Add buttons
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
            
            if (row) {
                if (update) {
                    await currentInteraction.update({ embeds: [embed], files: [img], components: [row] });
                } else await currentInteraction.editReply({ embeds: [embed], files: [img], components: [row] });
            } else {
                if (update) {
                    await currentInteraction.update({ embeds: [embed], files: [img] });
                } else await currentInteraction.editReply({ embeds: [embed], files: [img] });
            }
        }

        // Initial call
        getPlayerStats(false, season, interaction);

        // Collecting responses
        const filter = i => i.customId.split(`-`)[0] == `ps` && i.user.id == interaction.user.id && i.customId.split(`-`)[2] == details.id && i.customId.split(`-`)[3] == mode;
        const collector = interaction.channel.createMessageComponentCollector({ filter });
        collector.on(`collect`, async i => {
            collector.resetTimer();
            await require(`../methods/add-to-button-count.js`)(con);
            getPlayerStats(true, i.customId.split(`-`)[1], i);
        });
	},
};
