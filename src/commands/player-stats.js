// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const canvas = require(`canvas`);

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

module.exports = {
	data: new SlashCommandBuilder()
		.setName('player-stats')
		.setDescription(`Get a player's stats from any season after 1979-80.`)
        .addStringOption(option => option.setName(`name`).setDescription(`Player name`).setRequired(true))
        .addStringOption(option => option.setName(`season`).setDescription(`Season, e.g. 2019 for 2019-2020.`))
        .addStringOption(option => option.setName(`mode`).setDescription(`Regular/career/playoffs`)),
    
	async execute(variables) {
		let { interaction, ad } = variables;

        await interaction.deferReply();

        // Interaction options
        let requestedName = interaction.options.getString(`name`),
            requestedSeason = interaction.options.getString(`season`),
            requestedMode = interaction.options.getString(`mode`),
            season, mode, switchedToRegularSeason = false;

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
            console.log(season);
            if (!season) {
                season = lastPlayed[location[0]][Object.keys(possible[location[0]])[location[1]]];
            }
        }

        if (!season) season = lastPlayed[details.source][details.id];

        // Found a certain player
        let url = (details.source == `nba`) ? `http://data.nba.net/10s/prod/v1/${season}/players/${details.id}_profile.json` : `https://balldontlie.io/api/v1/season_averages?player_ids[]=${details.id}&season=${season}`;

        console.log(url);

        let json = await getJSON(url);

        let p, color = teamColors.NBA;
        if (details.source == `nba`) {
            try {
                if (mode == `regular`) {
                    let seasons = json.league.standard.stats.regularSeason.season;
                    for (var i = 0; i < seasons.length; i++) {
                        if (season == seasons[i].seasonYear) {
                            p = seasons[i].total;  

                            // Getting team color
                            if (seasons[i].teams.length == 1) color = teamColors[teamNames[seasons[i].teams[0].teamId]]; 
                            break;
                        }
                    }
                    if (!p) p = seasons[0].total;
                } else if (mode == `career`) {
                    p = json.league.standard.stats.careerSummary;

                    // Only using team color if every season is for that one team
                    let latestTeamId = json.league.standard.stats.regularSeason.season[0].teams[0].teamId, canUseTeamColor = true;
                    let seasons = json.league.standard.stats.regularSeason.season;
                    for (var i = 0; i < seasons.length; i++) {
                        if (seasons[i].teams.length > 1) {
                            canUseTeamColor = false;
                            break;
                        } else if (seasons[i].teams[0].teamId != latestTeamId) {
                            canUseTeamColor = false;
                            break;
                        }
                    }

                    if (canUseTeamColor) color = teamColors[teamNames[latestTeamId]];
                } else if (mode == `playoffs`) {
                    p = json.league.standard.stats.latest;
                    
                    let canUsePlayoffStats = true;
                    if (!p.seasonStageId) canUsePlayoffStats = false;
                    else if (p.seasonStageId != 4) canUsePlayoffStats = false;

                    if (!canUsePlayoffStats) {
                        return await interaction.editReply(`${season}-${season + 1} ${mode} stats could not be found for ${details.name}.`);
                    }

                    // Getting team color
                    let seasons = json.league.standard.stats.regularSeason.season;
                    for (var i = 0; i < seasons.length; i++) {
                        if (season == seasons[i].seasonYear) {  
                            if (seasons[i].teams.length == 1) color = teamColors[teamNames[seasons[i].teams[0].teamId]]; 
                            break;
                        }
                    }
                }

                for (var key in p) {
                    p[key] = parseFloat(p[key]);
                }
            } catch (e) {console.log(e)}
        } else { // Extra remapping for bdl
            if (mode != `regular`) return await interaction.editReply(`Only regular season stats are supported for seasons before 2016-2017.`);

            let statsExist = true;

            if (!json) statsExist = false;
            else if (!json.data) statsExist = false;
            else if (json.data.length == 0) statsExist = false;
            else if (!json.data[0]) statsExist = false;
            else if (!json.data[0].games_played) statsExist = false;

            if (!statsExist) return await interaction.editReply(`${season}-${season + 1} ${mode} stats could not be found for ${details.name}.`);

            p = json.data[0];
        }

        // Error catching
        if (!p) return await interaction.editReply(`${season}-${season + 1} ${mode} stats could not be found for ${details.name}.`);
        if (details.source == `nba` && !p.gamesPlayed) return await interaction.editReply(`${season}-${season + 1} ${mode} stats could not be found for ${details.name}.`);

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
            _gmsc = p.ppg + (0.4 * (p.fgm / p.g)) - (0.7 * (p.fga / p.g)) - (0.4 * ((p.fta / p.g) - (p.ftm / p.g))) + (0.7 * (p.offReb / p.g)) + (0.3 * (p.defReb / p.g)) + p.spg + (0.7 * p.apg) + (0.7 * p.bpg) - (0.4 * (p.pFouls / p.g)) - (p.turnovers / p.g);
            _plusMinus = (parseInt(p.plusMinus) < 0) ? p.plusMinus : `+${p.plusMinus}`;
        }

        // Setting up the canvas
        const width = 800, height = 270;
        const c = canvas.createCanvas(width, height);
        const x = c.getContext(`2d`);
        const image = new canvas.Image();

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

        let detailText = `${season}-${parseInt((season + 1).toString().substring(2, 4))} ${mode[0].toUpperCase()}${mode.substring(1, mode.length)} Stats:`;
        // More
        x.font = `25px WhitneyLight`;
        x.fillStyle = "#72767d";
        x.fillText(detailText, 2*x.measureText(details.name).width, 50);

        x.font = `25px WhitneyBold`;
        x.fillStyle = /*`#E56020`*/ color;
        x.fillText(`PPG`, 15, 70 + 20);
        x.fillText(`RPG`, 105, 70 + 20);
        x.fillText(`APG`, 200, 70 + 20);
        x.fillText(`BPG`, 300, 70 + 20);
        x.fillText(`SPG`, 395, 70 + 20);
        x.fillText(`FPG`, 490, 70 + 20);
        x.fillText(`TOPG`, 585, 70 + 20);
        x.fillText(`MPG`, 685, 70 + 20);

        x.font = `20px WhitneyLight`;
        x.fillStyle = `#FFFFFF`;
        x.fillText((details.source == `nba`) ? p.ppg : p.pts, 15, 100 + 20);
        x.fillText((details.source == `nba`) ? p.rpg : p.reb, 110, 100 + 20);
        x.fillText((details.source == `nba`) ? p.apg : p.ast, 205, 100 + 20);
        x.fillText((details.source == `nba`) ? p.bpg : p.blk, 300, 100 + 20);
        x.fillText((details.source == `nba`) ? p.spg : p.stl, 400, 100 + 20);
        x.fillText((details.source == `nba`) ? (p.pFouls/p.gamesPlayed).toFixed(1) : p.pf, 495, 100 + 20);
        x.fillText((details.source == `nba`) ? (p.turnovers/p.gamesPlayed).toFixed(1) : p.turnover, 590, 100 + 20);
        x.fillText((details.source == `nba`) ? p.mpg : p.min, 685, 100 + 20);

        x.font = `25px WhitneyBold`;
        x.fillStyle = /*`#E56020`*/ color;
        x.fillText(`FG%`, 15, 140 + 20);
        x.fillText(`FT%`, 105, 140 + 20);
        x.fillText(`2P%`, 200, 140 + 20);
        x.fillText(`3P%`, 295, 140 + 20);
        x.fillText(`eFG%`, 390, 140 + 20);
        x.fillText(`TS%`, 500, 140 + 20);
        x.fillText(`TOV%`, 595, 140 + 20);
        x.fillText(`GP`, 685, 140 + 20);

        x.font = `20px WhitneyLight`;
        x.fillStyle = `#FFFFFF`;
        x.fillText((details.source == `nba`) ? p.fgp : (p.fg_pct * 100).toFixed(1), 15, 170 + 20);
        x.fillText((details.source == `nba`) ? p.ftp : (p.ft_pct * 100).toFixed(1), 105, 170 + 20);
        x.fillText(_2pp, 200, 170 + 20);
        x.fillText((details.source == `nba`) ? p.tpp : (p.fg3_pct * 100).toFixed(1), 295, 170 + 20);
        x.fillText(_efgp, 390, 170 + 20);
        x.fillText(_tsp, 500, 170 + 20);
        x.fillText(_tovp, 595, 170 + 20);
        x.fillText(p.g, 685, 170 + 20);

        x.font = `25px WhitneyBold`;
        x.fillStyle = /*`#E56020`;*/ color;
        if (details.source == `nba`) {
            x.fillText(`G Started`, 15, 210 + 20);
            x.fillText(`Total +/-`, 195, 210 + 20);
            x.fillText(`3 Doubles`, 355, 210 + 20);
            x.fillText(`Average GmSc`, 540, 210 + 20);
        } else x.fillText(`Average GmSc`, 15, 210 + 20);

        x.font = `20px WhitneyLight`;
        x.fillStyle = `#FFFFFF`;
        if (details.source == `nba`) {
            x.fillText(p.gamesStarted, 15, 240 + 20);
            x.fillText(_plusMinus, 195, 240 + 20);
            x.fillText(p.td3, 355, 240 + 20);
            x.fillText(_gmsc.toFixed(1), 540, 240 + 20);
        } else x.fillText(_gmsc.toFixed(1), 15, 240 + 20);

        canvas.loadImage(`assets/images/logo.png`).then(image => {
            x.drawImage(image, 715, 185, 85, 85);

            let fileName = `${details.name.split(` `).join(`-`)}-${season}.png`;
            const img = new Discord.MessageAttachment(c.toBuffer(), fileName);

            let embed = new Discord.MessageEmbed()
                .setColor(color)
                .setImage(`attachment://${fileName}`);

            if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });
            
            return interaction.editReply({ embeds: [embed], files: [img] });
        });
	},
};
