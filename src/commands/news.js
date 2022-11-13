// Libraries
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require(`discord.js`);

// Assets
const teamColors = require(`../assets/teams/colors.json`);

// Methods
const getJSON = require(`../methods/get-json.js`);
const randInt = require(`../methods/randint.js`);

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`news`)
		.setDescription(`Get the latest basketball headlines from ESPN.`),
    
	async execute(variables) {
		let { interaction, ad } = variables;

		let json = await getJSON(`http://site.api.espn.com/apis/site/v2/sports/basketball/nba/news`);

        let randomArticle = randInt(0, json.articles.length - 1);

        let embed = new Discord.MessageEmbed()
            .setTitle(`:newspaper: Basketball News From ESPN:`)
            .setFooter({ text: `NBABot is made by chig#4519 and freejstn#0666` })
            .setImage(json.articles[randomArticle].images[0].url)
            .setColor(teamColors.NBA);

        for (var i = 0; i < json.articles.length; i++) {
            embed.addField(`${i + 1}) ${json.articles[i].headline}${(i == randomArticle) ? ` (Pictured)` : ``}`, `${json.articles[i].description} [Link](${json.articles[i].links.web.href})`);
        }
        
        if (ad) embed.setAuthor({ name: ad.text, url: ad.link, iconURL: ad.image });

        return await interaction.reply({ embeds: [embed] });
	},
};
