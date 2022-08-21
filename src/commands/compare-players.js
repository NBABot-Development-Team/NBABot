// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);
const canvas = require(`canvas`);
const teamColors = require(`../assets/teams/colors.json`);

// Assets
const ids = {
    bdl: require(`../assets/players/bdl/ids.json`),
};
const names = {
    bdl: require(`../assets/players/bdl/names.json`),
};
const lastPlayed = {
    bdl: require(`../assets/players/bdl/last-played.json`),
};

// Methods
const getJSON = require(`../methods/get-json.js`);
const formatSeason = require(`../methods/format-season.js`);

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`compare-players`)
        .setDescription(`Visually compare the regular seasons stats from any players after 1979.`)
        .addStringOption(option => option.setName(`player1_name`).setDescription(`The name of the first player, e.g. LeBron James.`).setRequired(true))
        .addStringOption(option => option.setName(`player1_season`).setDescription(`The season of the first player, e.g. 2017-18.`).setRequired(true))
        .addStringOption(option => option.setName(`player2_name`).setDescription(`The name of the second player, e.g. Stephen Curry.`).setRequired(true))
        .addStringOption(option => option.setName(`player2_season`).setDescription(`The season of the second player, e.g. 2015-16.`).setRequired(true))
        .addBooleanOption(option => option.setName(`per36`).setDescription(`Whether you want to adjust each player's stats per 36 minutes played.`)),
    
    async execute(variables) {
        let { interaction } = variables;

        await interaction.deferReply();

        let per36 = interaction.options.getBoolean(`per36`);
        if (!per36) per36 = false;

        let namesInput = [interaction.options.getString(`player1_name`), interaction.options.getString(`player2_name`)];
        let seasons = [formatSeason(interaction.options.getString(`player1_season`)), formatSeason(interaction.options.getString(`player2_season`))];
        let idsFinal = [], stats = [];

        // Checking that all inputs are valid, especially seasons
        if (!seasons[0]) return await interaction.editReply(`\`${interaction.options.getString(`player1_season`)}\` is not a valid season, either because it is in the future or formatted wrong. \`2021-22\` would be a a valid season.`); 
        if (!seasons[1]) return await interaction.editReply(`\`${interaction.options.getString(`player2_season`)}\` is not a valid season, either because it is in the future or formatted wrong. \`2021-22\` would be a a valid season.`);

        // Getting ids
        nameLoop: for (var i = 0; i < namesInput.length; i++) {
            let name = namesInput[i].toLowerCase();

            // Exact match
            if (ids.bdl[name]) {
                idsFinal.push(ids.bdl[name]);
                continue nameLoop;
            }

            // Multiple possibilities?
            let possible = {};
            for (var key in ids.bdl) {
                for (var j = 0; j < name.split(` `).length; j++) {
                    if (key.split(` `).includes(name.split(` `)[j])) {
                        if (!possible[ids.bdl[key]]) possible[ids.bdl[key]] = 1;
                        else possible[ids.bdl[key]]++;
                    }
                }
            }

            if (Object.keys(possible).length == 1) { // Only one possibility, thus certain
                idsFinal.push(Object.keys(possible)[0]);
                continue nameLoop;
            } else {
                // Any one with a score better than rest?
                let top = 0, count = 0;
                for (var key in possible) {
                    if (possible[key] > top) {
                        top = possible[key];
                        count = 1;
                    } else if (possible[key] == top) {
                        count++;
                    }
                }

                if (count == 1 && top > 0) { // One possibility has higher score than the rest, thus certain
                    idsFinal.push(key);
                    continue nameLoop;
                } else return await interaction.editReply(`\`${name}\` is not a valid or specific name of a player. You can find the player's exact name with \`/player-stats\`.`);
            }
        }

        for (var i = 0; i < idsFinal.length; i++) {
            let stat = await getJSON(`https://balldontlie.io/api/v1/season_averages?player_ids[]=${idsFinal[i]}&season=${seasons[i]}`);
            stats.push(stat.data[0]);
        }

        if (!stats[0]) return await interaction.editReply(`${seasons[0]}-${seasons[0] + 1} regular stats could not be found for ${names.bdl[idsFinal[0]]}.`);
        if (!stats[1]) return await interaction.editReply(`${seasons[1]}-${seasons[1] + 1} regular stats could not be found for ${names.bdl[idsFinal[1]]}.`);

        const canvas_width = 1000;
        const canvas_height = (per36) ? 875 : 850;

        const c = canvas.createCanvas(canvas_width, canvas_height);
        const x = c.getContext(`2d`);
        const image = new canvas.Image();

        // Fonts
        canvas.registerFont(`./assets/fonts/whitney-500.ttf`, {family: `WhitneyLight`});
        canvas.registerFont(`./assets/fonts/whitney-700.ttf`, {family: `WhitneyBold`});


        // Background
        x.fillStyle = `#2F3136`;
        x.fillRect(0, 0, canvas_width, canvas_height);

        // Names
        x.fillStyle = `#FFFFFF`;
        x.font = `45px WhitneyBold`;
        x.fillText(names.bdl[idsFinal[0]], 15, 60);
        x.fillText(names.bdl[idsFinal[1]], 990 - x.measureText(names.bdl[idsFinal[1]]).width, 60);
        x.fillRect(0, 75, canvas_width, 10);
        
        // Seasons
        x.font = `45px WhitneyLight`;
        x.fillStyle = "#72767d";
        x.fillText(`${seasons[0]}-${seasons[0] + 1}`, 15, 135);
        x.fillText(`${seasons[1]}-${seasons[1] + 1}`, 750, 135);

        if (per36) {
            // Adjusting stats to per 36 mins
            for (var i = 0; i < stats.length; i++) {
                let multiplier = 36 / (parseInt(stats[i].min.split(`:`)[0]) + (parseFloat(stats[i].min.split(`:`)[1]) / 60));
                for (var stat in stats[i]) {
                    if (![`games_played`, `player_id`, `season`, `min`, `fg_pct`, `fg3_pct`, `ft_pct`].includes(stat)) {
                        let adjustedStat = parseFloat(stats[i][stat] * multiplier);
                        if (adjustedStat < 1) {
                            stats[i][stat] = parseFloat(adjustedStat.toPrecision(2));
                        } else stats[i][stat] = parseFloat(adjustedStat.toPrecision(3));
                    }
                }
            }
        }

        let keys = [`pts`, `reb`, `ast`, `blk`, `stl`, `pf`, `turnover`, `fg_pct`, `fg3_pct`, `ft_pct`];

        // Drawing proportional colours
        for (var i = 0; i < stats.length; i++) {
            let o = (i == 0) ? 1 : 0;
            for (var j = 0; j < keys.length; j++) {
                let proportions = [parseInt(1000 * (stats[i][keys[j]] / (stats[i][keys[j]] + stats[o][keys[j]]))), parseInt(1000 * (stats[o][keys[j]] / (stats[i][keys[j]] + stats[o][keys[j]])))];
                if ([`pf`, `turnover`].includes(keys[j])) {
                    x.fillStyle = (stats[i][keys[j]] > stats[o][keys[j]]) ? `#FFBDBD` : `#BDFFBD`;
                } else {
                    x.fillStyle = (stats[i][keys[j]] > stats[o][keys[j]]) ? `#BDFFBD` : `#FFBDBD`;
                }
                x.fillRect((i == 0) ? 0 : (1000 - proportions[0]), 150 + (j * 65), proportions[0], 50);
            }
        }

        // Drawing stats
        x.font = `40px WhitneyBold`;
        x.fillStyle = `#000000`;
        for (var i = 0; i < keys.length; i++) {
            if ([`fg_pct`, `fg3_pct`, `ft_pct`].includes(keys[i])) stats[0][keys[i]] = parseFloat(parseFloat(stats[0][keys[i]] * 100).toPrecision(3));
            x.fillText(stats[0][keys[i]], 15, 190 + (i * 65));
        }
        for (var i = 0; i < keys.length; i++) {
            if ([`fg_pct`, `fg3_pct`, `ft_pct`].includes(keys[i])) stats[1][keys[i]] = parseFloat(parseFloat(stats[1][keys[i]] * 100).toPrecision(3));
            // x.fillText(stats[1][keys[i]], 1000 - (stats[1][keys[i]].toString().length * 25), 190 + (i * 65));
            x.fillText(stats[1][keys[i]], 990 - x.measureText(stats[1][keys[i]]).width, 190 + (i * 65));
        }

        // Drawing stat labels
        let x_t = [`PPG`, `RPG`, `APG`, `BPG`, `SPG`, `FPG`, `TOPG`, `FG%`, `3P%`, `FT%`];
        x.font = `40px WhitneyLight`;
        x.fillStyle = `#000000`;
        for (var i = 0; i < keys.length; i++) {
            let x_c = (canvas_width / 2) - (x.measureText(x_t[i]).width / 2);
            x.fillText(x_t[i], x_c, 190 + (i * 65));
        }

        // Extras
        x.font = `30px WhitneyLight`;
        x.fillStyle = `#FFFFFF`;
        x.fillText((!per36) ? `Note: These stats are not adjusted per 36 minutes played.` : `Note: These stats are adjusted per 36 minutes played.`, 15, 825);

        //Create Versus Text 
        const text = "VS"
        x.textBaseline = 'top'
        x.fillStyle = '#FFFFFF'
        const textWidth = x.measureText(text).width;
        x.fillRect(canvas_width/2 - textWidth/2 - 30, 45, textWidth + 60, 60)

        x.fillStyle = '#2F3136'
        x.font = `45px WhitneyBold`;
        x.fillText(text, canvas_width/2 - textWidth/2 - 10, 45);

        //x.fillStyle = `#0063fa`;
        //x.fillRect(0, (!per36) ? 850 : 905, canvas_width, 70);
        //x.fillStyle = `#FFFFFF`;
        //x.fillText(`Made by @EliotChignell/chig#4519`, 15, (!per36) ? 895 : 950);
        //x.fillText(`NBABot (nbabot.js.org)`, 615, (!per36) ? 895 : 950);

        //Load Image and Send Reply
        canvas.loadImage(`assets/images/logo.png`).then(image => {
            x.drawImage(image, (per36) ? canvas_width-83 : canvas_width - 60 , (per36) ? canvas_height-83 : canvas_height-60, (per36) ? 75 : 50, (per36) ? 75 : 50);
            let fileName = `${names.bdl[idsFinal[0]].split(` `)[1]}${seasons[0]}-${names.bdl[idsFinal[1]].split(` `)[1]}${seasons[1]}.png`;
            //Create Embed for Reply
            let embed = new Discord.MessageEmbed()
                .setTitle("Player Comparison:")
                .setColor(teamColors.NBA)
                .setImage(`attachment://${fileName}`);

            //Reply
            const img = new Discord.MessageAttachment(c.toBuffer(), fileName);
            return interaction.editReply({ embeds: [embed], files: [img] });
        });
    },
};
