/*

/setup-auto-scores start
- if donator
- if >1 available channels
- start doing auto scores in this channel

/setup-auto-scores stop
- stop auto scores, gain +1 available channels

*/

// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
// const { client } = require('../bot.js');

// Methods
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`auto-scores`)
		.setDescription(`(Finals MVP donator only) choose where you want your automated scores to be`)
        .addStringOption(option => option.setName(`option`).setDescription(`Whether you want to start or stop live scores in this channel.`).addChoices({
            name: `Start`,
            value: `start`
        }).addChoices({
            name: `Stop`,
            value: `stop`
        }).setRequired(true)),
    
	async execute(variables) {
		let { con, interaction, client, shardID } = variables;

		let user = await query(con, `SELECT * FROM users WHERE ID = "${interaction.user.id}";`);
        user = user[0];

        // Checking if user is donator
        if (user.Donator != `y` && user.Donator != `f`) return await interaction.reply(`Only Finals MVP donators can use auto scores that update every 60 seconds. To learn more, use \`/donate\`.\nThe NBABot Support Server (https://invite.gg/nbabot) supports live scores which update every 20 minutes through the #live-scores channel.`);
        if (user.Donator == `y`) return await interaction.reply(`This feature is only available to Finals MVP Donators.`);

        // Seeing whether start/stop
        let option = interaction.options.getString(`option`);

        let users = await query(con, `SELECT * FROM users WHERE Donator = "f";`);
        
        for (var i = 0; i < users.length; i++) {
            let user = users[i];
            if (!user.ScoreChannels) continue;
            if (user.ScoreChannels == "NULL") continue;
            // guild-channel-msg-date-shard
            let details = user.ScoreChannels.split(`-`);
            if (details.length != 5) continue;

            let channel;
            try {
                channel = await client.channels.fetch(details[1]);
            } catch (e) {
                // ...
            }
            if (!channel) continue;

            // Cool, so we know this shard has that channel in it
            details[4] = shardID.toString();
            await query(con, `UPDATE users SET ScoreChannels = "${details.join(`-`)}" WHERE ID = "${user.ID}"`);
        }

        switch(option.toLowerCase()) {
            case `start`:
                if (user.ScoreChannels && user.ScoreChannels != `NULL`) return await interaction.reply(`You currently already have live scores running. Use \`/auto-scores stop\` in that channel to start in this channel.`);
                
                // Trying to send message
                let currentChannel = await client.channels.fetch(interaction.channel.id);
                let testMessage;
                try {
                    testMessage = await currentChannel.send(`Check 1/2 done`);

                    try {
                        await testMessage.edit(`Check 2/2 done - You can delete this message`);
                    } catch (e) {
                        return await interaction.reply(`\`auto-scores\` will not work in this channel because NBABot does not have enough permissions to **edit** messages. Give NBABot the permissions \`Send messages\`, \`Embed links\`, and \`Manage messages\` - then try this command again.`);
                    }
                } catch (e) {
                    return await interaction.reply(`\`auto-scores\` will not work in this channel because NBABot does not have enough permissions to **send** messages. Give NBABot the permissions \`Send messages\`, \`Embed links\`, and \`Manage messages\` - then try this command again.`);
                }

                await query(con, `UPDATE users SET ScoreChannels = "${interaction.guild.id}-${interaction.channel.id}-0-0-0" WHERE ID = "${interaction.user.id}";`);
                return await interaction.reply(`Live scores should start in this server soon.`);
                break;

            case `stop`:
                await query(con, `UPDATE users SET ScoreChannels = "NULL" WHERE ID = "${interaction.user.id}";`);
                return await interaction.reply(`Live scores stopped in this channel. You can now \`/auto-scores start\` in another channel.`);
                break;
        }
	},
};
