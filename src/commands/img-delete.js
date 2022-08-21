// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`img-delete`)
		.setDescription(`Delete an image from your server. Use /imgs to see the images on your server.`)
        .addStringOption(option => option.setName(`name`).setDescription(`The name of the image.`)),
    
	async execute(variables) {
		let { con, interaction } = variables;

        if (!interaction.member.permissions.has(`MANAGE_GUILD`)) return await interaction.reply(`Only users with the \`Manage Server\` permission can add/delete images from the server.`);

        let name = interaction.options.getString(`name`).toLowerCase();

        let images = await query(con, `SELECT * FROM images WHERE ID = '${interaction.guild.id}';`);
        let imagesExist = true;
        if (!images) imagesExist = false;
        if (images.length == 0) imagesExist = false;
        if (!imagesExist) return await interaction.reply(`Your server has no images. Add images with \`/img-add\`.`);

        images = JSON.parse(images[0].Data);

        if (!images[name]) return await interaction.reply(`\`${name}\` is not a registered image in this server. Use \`/imgs\` to see the images on your server.`);
    
        let imageURL = images[name];
        delete images[name];
        images = JSON.stringify(images);

        await query(con, `UPDATE images SET Data = '${images}' WHERE ID = '${interaction.guild.id}';`);

        let embed = new Discord.MessageEmbed()
            .setColor(teamColors.NBA)
            .addField(`Success! \`name\` image deleted from your server.`, `Image URL: [${imageURL}](${imageURL})`);

        return await interaction.reply({ embeds: [embed] });
    },
};
