// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);
const fetch = require(`node-fetch`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const query = require(`../methods/database/query.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('img-add')
		.setDescription('Add images to your server with a name and an attached image.')
        .addStringOption(option => option.setName(`name`).setDescription(`The name of the image.`).setRequired(true))
        .addStringOption(option => option.setName(`image`).setDescription(`The link to the image. Right click, and press "Copy Link" to get a link for the image.`).setRequired(true)),
    
	async execute(variables) {
		let { con, interaction } = variables;

        await interaction.deferReply();

        if (!interaction.member.permissions.has(`MANAGE_GUILD`)) return await interaction.editReply(`Only users with the \`Manage Server\` permission can add/delete images from the server.`);

        let name = interaction.options.getString(`name`).toLowerCase();
        let image = interaction.options.getString(`image`);
        let replacingImage;

        // Checking the image as a valid image
        fetch(image)
            .catch(async err => {
                if (err) return await interaction.editReply(`Please specify a valid image URL. E.g. \`https://nbabot.js.org/mj.png\`. [Error 0]`);
            })
            .then(async res => {
                if (!res) return await interaction.editReply(`Please specify a valid image URL. E.g. \`https://nbabot.js.org/mj.png\`. [Error 1]`);
                if (!res.headers) return await interaction.editReply(`Please specify a valid image URL. E.g. \`https://nbabot.js.org/mj.png\`. [Error 2]`);
                if (res.headers.raw()[`content-type`].toString().split(`/`)[0] != `image`) return await interaction.editReply(`Please specify a valid image URL. E.g. \`https://nbabot.js.org/mj.png\`. [Error 3]`);

                let images = await query(con, `SELECT * FROM images WHERE ID = "${interaction.guild.id}";`);
                let imagesExist = true;
                if (!images) imagesExist = false;
                if (images.length == 0) imagesExist = false;
                if (!imagesExist) {
                    images = {}; images[name] = image;
                    await query(con, `INSERT INTO images (ID, Data) VALUES ('${interaction.guild.id}','${JSON.stringify(images)}');`);
                    let embed = new Discord.MessageEmbed()
                        .setColor(teamColors.NBA)
                        .addField(`Success! \`${name}\` added to your server. Retrieve it with \`/img ${name}\`.`, `Image URL: [${image}](${image})`);
                    return await interaction.editReply({ embeds: [embed] });
                }

                images = JSON.parse(images[0].Data);
                if (images[name]) replacingImage = images[name];
                images[name] = image;
                await query(con, `UPDATE images SET Data = '${JSON.stringify(images)}' WHERE ID = '${interaction.guild.id}';`);

                let embed = new Discord.MessageEmbed()
                    .setColor(teamColors.NBA)
                    .addField(`Success! \`${name}\` added to your server. Retrieve it with \`/img ${name}\`.`, `Image URL: [${image}](${image})`);
                if (replacingImage) embed.setFooter({ text: `Note: an image was replaced under the same name. This is the link for the previous image: ${replacingImage}.` });

                return await interaction.editReply({ embeds: [embed] });
            });

        // if (image.contentType.split(`/`)[0] != `image`) return await interaction.reply(`Please upload an image, e.g. a .jpg or .png file.`);
	},
};
