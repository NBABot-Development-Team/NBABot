// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);
const teamIDs = require(`../assets/teams/ids.json`);
const teamNicknames = require(`../assets/teams/nicknames.json`);
const teamEmojis = require(`../assets/teams/emojis.json`);
const teamNames = require(`../assets/teams/names.json`);

// Methods
const formatTeam = require(`../methods/format-team.js`);
const getJSON = require(`../methods/get-json.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`transactions`)
		.setDescription('View the latest player transactions')
        .addStringOption(option => option.setName(`team`).setDescription(`Which team's transcations you want to view. Leave blank for the entire league`)),
    
	async execute(variables) {
		let { interaction } = variables;

		// Getting team
        let team = interaction.options.getString(`team`);
        team = formatTeam(team);

        // Getting latest transactions
        let json = await getJSON(`https://stats.nba.com/js/data/playermovement/NBA_Player_Movement.json`);

        if (!json) return await interaction.reply(`Could not fetch latest player transactions. There is an issue with NBA's API.`);
        if (!json.NBA_Player_Movement) return await interaction.reply(`Could not fetch latest player transactions. There is an issue with NBA's API.`);
        if (!json.NBA_Player_Movement.rows) return await interaction.reply(`Could not fetch latest player transactions. There is an issue with NBA's API.`);

        let embed = new Discord.MessageEmbed()
            .setColor((team) ? teamColors[team] : teamColors.NBA)
            .setTitle(`${(team) ? teamEmojis[team] : teamEmojis.NBA} Latest player transactions for the ${(team) ? teamNicknames[team] : `NBA`}:`);

        let counter = 0;
        transactionLoop: for (var i = 0; i < json.NBA_Player_Movement.rows.length; i++) {
            if (counter >= 10) break transactionLoop;
            let t = json.NBA_Player_Movement.rows[i];
            if (team) {
                if (t.TEAM_ID != teamIDs[team]) continue transactionLoop;
                embed.addField(`${t.Transaction_Type} on ${new Date(t.TRANSACTION_DATE).toDateString()}`, t.TRANSACTION_DESCRIPTION, false);
                counter++;
            } else {
                embed.addField(`${t.Transaction_Type} by the ${teamNicknames[teamNames[t.TEAM_ID]]} ${teamEmojis[teamNames[t.TEAM_ID]]}`, t.TRANSACTION_DESCRIPTION, false);
                counter++;
            }
        }

        return await interaction.reply({ embeds: [embed] });
    },
};