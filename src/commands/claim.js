// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Methods
const query = require(`../methods/database/query.js`);
const claimBets = require(`../methods/claim-bets.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`claim`)
		.setDescription(`If your bets haven't automatically been claimed, use this command.`),
    
	async execute(variables) {
		let { interaction, con } = variables;

        await interaction.deferReply();

        // Getting currentDate
        delete require.cache[require.resolve(`../cache/today.json`)];
        let currentDate = require(`../cache/today.json`).links.currentDate;

		let bets = await query(con, `SELECT * FROM bets WHERE ID = "${interaction.user.id}";`);

        // Checking if the user has placed bets
        let betsExist = true;
        if (!bets) betsExist = false;
        else if (bets.length == 0) betsExist = false;

        if (!betsExist) return await interaction.editReply(`You have no bets to claim. [1]`);
        bets = bets[0];

        // Cycling through each bet and seeing if it can be claimed
        let betsClaimed = 0;
        dateLoop: for (var key in bets) {
			
            // Checking if there's any bets for the date
            if (key == `ID` || !key.split(``).includes(`d`)) continue;
            if (!bets[key]) continue;

			await claimBets(key.split(`d`).join(``));
			/*
            // Checking if the date is in the future
            if (parseInt(currentDate) < parseInt(key.split(`d`).join(``))) continue;

            let b = bets[key].split(`,`);
            for (var i = 0; i < b.length; i++) {
            	console.log(b[i]);
                let betsClaimedFromDate = await claimBets(key.split(`d`).join(``), interaction.user.id, b[i].split(`|`)[0]);
                betsClaimed += betsClaimedFromDate;
            }
        
            // let betsClaimedFromDate = await claimBets(key.split(`d`).join(``), interaction.user.id);
            // betsClaimed += betsClaimedFromDate;

			*/
        }

        if (betsClaimed == 0 || !betsClaimed) return await interaction.editReply(`You have no bets to claim. [2]`);
        else return await interaction.editReply(`\`${betsClaimed}\` bets were claimed. Check your DMs for details.`);
	},
};
