// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`all-time-leaders`)
		.setDescription(`Find the NBA all-time leaders of a particular stat category.`)
        .addStringOption(option => option.setName(`stat`).setDescription(`Which statistic you want to see the all-time leaders of.`).addChoices({
            name: `Games Played`,
            value: `GP`
        }).addChoices({
            name: `Points`,
            value: `PTS`
        }).addChoices({
            name: `Assists`,
            value: `AST`
        }).addChoices({
            name: `Steals`,
            value: `STL`
        }).addChoices({
            name: `Offensive Rebounds`,
            value: `OREB`
        }).addChoices({
            name: `Defensive Rebounds`,
            value: `DREB`
        }).addChoices({
            name: `Total Rebounds`,
            value: `REB`
        }).addChoices({
            name: `Blocks`,
            value: `BLK`
        }).addChoices({
            name: `Field Goals Made`,
            value: `FGM`
        }).addChoices({
            name: `Field Goals Attempted`,
            value: `FGA`
        }).addChoices({
            name: `Turnovers`,
            value: `TOV`
        }).addChoices({
            name: `Three Pointers Made`,
            value: `FG3M`
        }).addChoices({
            name: `Three Pointers Attempted`,
            value: `FG3A`
        }).addChoices({
            name: `Personal Fouls`,
            value: `PF`
        }).addChoices({
            name: `Free Throws Made`,
            value: `FTM`
        }).addChoices({
            name: `Free Throws Attempted`,
            value: `FTA`
        }).setRequired(true)),
    
	async execute(variables) {
		let { interaction, ad } = variables;

		let stat = interaction.options.getString(`stat`);

        await interaction.deferReply();

        fetch(`https://stats.nba.com/stats/alltimeleadersgrids?LeagueID=00&PerMode=Totals&SeasonType=Regular+Season&TopX=20`, {
            headers: require(`../config.json`).headers
        }).then(async res => {
            let json = await res.text();
            json = JSON.parse(json);
            json = json.resultSets;

            for (var i = 0; i < json.length; i++) {
                if (json[i].name == `${stat}Leaders`) {
                    let embed = new Discord.MessageEmbed()
                        .setTitle(`__All-time NBA ${stat} leaders:__`)
                        .setColor(teamColors.NBA);

                    let leaders = json[i].rowSet;
                    let description = ``;
                    for (var j = 0; j < leaders.length; j++) {
                        description += `${j + 1}) \`${leaders[j][2]}\` -  **${leaders[j][1]}${(leaders[j][4] == `Y` ? `*` : ``)}**\n`;
                    }
                    description += `* - Active`;
                    embed.setDescription(description);

                    if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

                    return await interaction.editReply({ embeds: [embed] });
                }
            }
        })
	},
};
