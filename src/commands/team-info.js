// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const wiki = require(`wikipedia`);
const fetch = require(`node-fetch`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamLogos = require(`../assets/teams/logos.json`);

// Methods
const formatTeam = require(`../methods/format-team.js`);
const getJSON = require(`../methods/get-json.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`team-info`)
		.setDescription(`Get basic info on a team, as well as current injuries.`)
        .addStringOption(option => option.setName(`team`).setDescription(`An NBA team, e.g. PHX or Lakers.`).setRequired(true)),
    
	async execute(variables) {
		let { interaction } = variables;
        
        await interaction.deferReply();
        
        let team = interaction.options.getString(`team`), teamDetails;
        team = formatTeam(team);

        if (!team) return await interaction.editReply(`Please use a valid NBA team. Use \`/teams\` for a full list.`);

        let teams = require(`../assets/teams/details.json`);

        for (var i = 0; i < teams.league.standard.length; i++) {
            if (teams.league.standard[i].tricode == team) {
                teamDetails = teams.league.standard[i];
                break;
            }
        }

        if (!teamDetails) return await interaction.editReply(`Please use a valid NBA team. Use \`/teams\` for a full list.`);

        let embed = new Discord.MessageEmbed()
            .setTitle(`Team information for the ${teamDetails.fullName}:`)
            .setColor(teamColors[team])
            .setThumbnail(teamLogos[team]);

        // Wikipedia info
        try {
            const page = await wiki.page(teamDetails.fullName);
            const summary = await page.summary();

            embed.setDescription(`${summary.extract.substring(0, 256)}... [Wikipedia](${page.fullurl})`);
        } catch (e) {
            console.log(e);
        }

        embed.addField(`Tricode`, team, true)
            .addField(`ID`, teamDetails.teamId, true)
            .addField(`Conference`, teamDetails.confName, true)
            .addField(`Division`, teamDetails.divName, true);

        let json = await getJSON(`https://www.rotowire.com/basketball/tables/injury-report.php?team=${team}&pos=ALL`);

        let str1 = `__Current Injuries__`, str2 = ``;
        if (json instanceof Array) {
            if (json.length > 0) {
                for (var i = 0; i < json.length; i++) {
                    str2 += `**${json[i].player}:** ${json[i].status} - ${json[i].injury}\n`;
                }
            } else str2 = `None`;
        } else str2 = `None`;

        embed.addField(str1, str2, false);

        return await interaction.editReply({ embeds: [embed] });
	},
};
