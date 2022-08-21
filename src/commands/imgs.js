// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`imgs`)
		.setDescription(`Show the images registered for your server.`),
    
	async execute(variables) {
		let { con, interaction } = variables;

        await interaction.deferReply();

		// Getting the server's images
        let images = await query(con, `SELECT * FROM images WHERE ID = '${interaction.guild.id}';`);
        let imagesExist = true;
        if (!images) imagesExist = false;
        if (images.length == 0) imagesExist = false;
        if (!imagesExist) return await interaction.editReply(`Your server has no images. Add them with \`/img-add\`.`);

        images = JSON.parse(images[0].Data);

        let embed = new Discord.MessageEmbed()
            .setTitle(`Images for ${interaction.guild.name}:`)
            .setColor(teamColors.NBA);
        let description = [];

        Object.keys(images)
            .sort()
            .forEach((v, i) => {
                description.push(`\`${v}\`: [Link](${images[v]})`);
            });

        console.log(`Guild: ${interaction.guild.id}, Images: ${description.length}, Length: ${description.join(`, `).length}`);

        if (description.join(`, `).length > 4000) {
            let descriptions = []; currentArray = [];
            descriptionLoop: for (var i = 0; i < description.length; i++) {
                let tempArray = [...currentArray];
                tempArray.push(description[i]);
                console.log(`currentArray: ${currentArray.length}, ${currentArray.join(`, `).length}, tempArray: ${tempArray.length}`)
                if (tempArray.join(`, `).length < 4000) {
                    currentArray.push(description[i]);
                    if (i == description.length - 1) {
                        descriptions.push(currentArray.join(`, `));
                        break descriptionLoop;
                    }
                } else {
                    console.log(currentArray.join(`, `).length);
                    descriptions.push(currentArray.join(`, `));
                    currentArray = [description[i]];
                }
            }

            let allEmbeds = [];
            for (var i = 0; i < descriptions.length; i++) {
                let e = new Discord.MessageEmbed()
                    .setColor(teamColors.NBA)
                    .setDescription(descriptions[i]);

                if (i == 0) e.setTitle(`Images for ${interaction.guild.name}:`);
                allEmbeds.push(e);
            }

            console.log(allEmbeds.length);

            await interaction.editReply({ embeds: [allEmbeds[0]] });

            for (var i = 1; i < allEmbeds.length; i++) {
                console.log(i);
                await interaction.channel.send({ embeds: [allEmbeds[i]] });
            }
            return;
        } else description = description.join(`, `); 
        
        console.log(description);
        embed.setDescription(description); // Hopefully not larger than 4096

        return await interaction.editReply({ embeds: [embed] });
	},
};
