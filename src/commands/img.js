// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('img')
		.setDescription('Retrieve images from your server.')
        .addStringOption(option => option.setName(`name`).setDescription(`The image's name. Use /imgs to see all the images for your server.`).setRequired(true)),
    
	async execute(variables) {
		let { interaction, con } = variables;

        let name = interaction.options.getString(`name`);

        // Trying to get the server's images
        let images = await query(con, `SELECT Data FROM images WHERE ID = "${interaction.guild.id}";`);
        let imagesExist = true;
        if (!images) imagesExist = false;
        if (images.length == 0) imagesExist = false;
        if (!imagesExist) return await interaction.reply(`Your server has no images. Add them with \`/img-add\`.`);

        images = JSON.parse(images[0].Data);
        if (images[name.toLowerCase()]) {
            let embed = new Discord.MessageEmbed()
                .setImage(images[name.toLowerCase()])
                .setDescription(name.toLowerCase())
                .setColor(teamColors.NBA);
            
            return await interaction.reply({ embeds: [embed] });
        } else return await interaction.reply(`\`${name}\` is not a registered image on this server. Check the images on this server with \`/imgs\`.`);
	},
};
