<h1 align="center"><img src="https://i.imgur.com/mCr1gL0.png" width="300"></h1>

<h4 align="center">A Discord bot for NBA scores, stats, news and simulated betting.</h4>

<p align="center">
  <a href="https://discord.gg/njhVCmF"><img src="https://discordapp.com/api/guilds/547294716606021643/widget.png?style=shield" alt="Support Server"></a>
  <a href="https://top.gg/bot/544017840760422417"><img src="https://top.gg/api/widget/servers/544017840760422417.svg"></a>
  <img alt="Lines of code" src="https://img.shields.io/tokei/lines/github/eliotchignell/nbabot?&label=total%20lines">
</p>
<p align="center">
 <a href="https://patreon.com/nbabot"><img src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.vercel.app%2Fapi%3Fusername%3Dnbabot%26type%3Dpatrons&style=flat" alt="Support me on Patreon" /></a>
  <a href="http://makeapullrequest.com">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
</p>

# The Story Thus Far
Hi, we're [Eliot](https://www.github.com/EliotChignell) and [Justin](https://www.github.com/freejstnalxndr), and we are the creators of NBABot. We met around 2018 when the project was in its very early stages. We are fans of the Suns and Knicks respectively, Eliot being from New Zealand, and Justin being from New York.

NBABot is truly influenced by our users feedback and our passion for the game of basketball. When NBABot first started, we had no clue it would become as big as it is today, and we owe that to our users. We want people to get involved, give feedback, and be able to see how much this project means to us.  Some of the premier features of the bot are:

 - Live Scores
 - Simulated Betting 
 - News Updates 
 - Player Comparisons

And many more. You can check it out by [inviting NBABot](https://discord.com/oauth2/authorize?client_id=544017840760422417&permissions=534723816512&scope=applications.commands%20bot), or using NBABot in our [support server](https://discord.gg/njhVCmF).

# Installation
The installation of NBABot to run on your own is something that requires a previous knowledge of [discord.js](https://discord.js.org/#/), javascript, and basic coding principals. *We are working on documentation and expect some more news on this front soon.*

1. Download NBABot's source code either through downloading it as a .zip file, or with the command `git clone https://https://github.com/NBABot-Development-Team/NBABot.git`.
2. Install NodeJS on your computer.
- For MacOS/Linux, I would recommend using [nvm](https://github.com/nvm-sh/nvm).
- For Windows, you can just install NodeJS from the official website [here](https://nodejs.org/en/download/).
- The current reccommended version of NodeJS to install is `v16.17.0`, but you are free to try and get other versions working.
3. From the `/src` directory, you will to need to install the required packages with the command `npm install`.
- Note: the package `node-canvas` usually does not install at first, so make sure you follow the installation steps [here](https://github.com/Automattic/node-canvas) if an error occurs during installation.
4. Create a Discord bot if you have not already:
- Go to the Discord Developers page [here](http://discord.com/developers) and press the 'New Application' button.
- Give your Discord bot a name
- Then, navigate to the 'Bot' tab, and press 'Add Bot'.
- Now, you can invite your bot to a server:
  - Press the 'OAuth2' tab,
  - Press the 'URL Generator' tab under 'OAuth2',
  - Select 'bot' and 'applications.commands' under 'Scopes'
  - Then select - at a minumum - the 'Bot Permissions': 'Send Messages', 'Send Messages in Threads', 'Manage Messages', 'Embed Links', 'Attach Files', 'Read Message History', 'Use External Emojis' and 'Use Slash Commands'. If you ever get into issues with the bot not having enough permissions, you can just give it 'Administrator' and things should be sorted out.
  - Copy the link at the bottom and use the link to invite the bot to a server.
5. Make a copy of the file `config.json.example`.
6. Rename the copy to `config.json`.
7. Open the new `config.json` file and insert the following **essential** details:
- `token` is your Discord Bot's token, which you can find back at the Discord Developers page, under the 'Bot' tab. Press 'Reset Token' and copy the long string of letters which appear.
- `clientId` is your Discord Bot's Application ID, which you can find back on the Discord Developers page, under the 'General Information', tab, as 'Application ID'.
- `activityText` is the message NBABot has when you click its profile, change this to whatever you like
  - For example, `"activityText": "with stats"`, will change NBABot's activity status to `Playing with stats`.
- All the rest are unnecessary and only used for the official NBABot.
8. Go back to your command line and run `node bot.js`.
9. NBABot should now be running in your server!
- To keep it running in the background, I would recommend a package like [pm2](https://pm2.keymetrics.io).
- If the slash commands do not appear when in NBABot's server, type `nba update` into the server and the commands should be added.

**Note:** NBABot currently is only available in a limited form without the simulated betting and user settings, as those require a MySQL database on your computer. This will later be explained with a guide. If you are confident enough, you can try install MySQL, use the framework database `nba.sql`, then try the database commands, but I cannot guarantee they will work at this stage.

# How to Support Us
NBABot, as much as it is a passion project, is very time consuming and involves a lot of upfront cost. We hope to not only one day be able to pay for the server costs (around $90 USD per month), but also further development and in bringing on other experts to help us with Web Development or marketing.

If you want to support us monetarily, you can support on [Patreon](https://www.patreon.com/nbabot).

Otherwise, you can vote for us on [top.gg](https://top.gg/bot/544017840760422417), and you'll also recieve $10 in the virtual betting system!

# License

Released under the [GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html) license.
