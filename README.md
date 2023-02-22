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

# Table of Contents
  
- [The Story Thus Far](#the-story-thus-far)
- [Installation](#installation)
- [Feature & Command List](#feature---command-list)
- [How to Make a Contribution](#how-to-make-a-contribution)
- [How to Support Us](#how-to-support-us)
- [License](#license)

  
  
# The Story Thus Far
Hi, we're [Eliot](https://www.github.com/EliotChignell) and [Justin](https://www.github.com/freejstnalxndr), and we are the creators of NBABot. We met around 2018 when the project was in its very early stages. We are fans of the Suns and Knicks respectively, Eliot being from New Zealand, and Justin being from New York.

NBABot is truly influenced by our users feedback and our passion for the game of basketball. When NBABot first started, we had no clue it would become as big as it is today, and we owe that to our users. We want people to get involved, give feedback, and be able to see how much this project means to us.  Some of the premier features of the bot are:

 - Live Scores
 - Simulated Betting 
 - News Updates 
 - Player Comparisons

And many more. You can check it out by [inviting NBABot](https://discord.com/oauth2/authorize?client_id=544017840760422417&permissions=534723816512&scope=applications.commands%20bot), or using NBABot in our [support server](https://discord.gg/njhVCmF).
  
Feel free to check out our [website](https://nbabot.js.org/) as well.

# Installation
The installation of NBABot to run on your own is something that requires a previous knowledge of [discord.js](https://discord.js.org/#/), javascript, and basic coding principals. *We are working on documentation and expect some more news on this front soon.*

__**Watch a video guide for macOS here: [https://www.youtube.com/watch?v=H43I2qVlAJY](https://www.youtube.com/watch?v=H43I2qVlAJY)**__

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
8. Create a `cache` folder in the `src` directory.
8. You will need to create a file called `today.json` in a `src/cache` directory, then copy the contents [here](http://data.nba.net/10s/prod/v2/today.json) to that file.
9. Go back to your command line and run `node bot.js`.
10. NBABot should now be running in your server!
- To keep it running in the background, I would recommend a package like [pm2](https://pm2.keymetrics.io).
- If the slash commands do not appear when in NBABot's server, type `nba update` into the server and the commands should be added.

**Note:** NBABot currently is only available in a limited form without the simulated betting and user settings, as those require a MySQL database on your computer. This will later be explained with a guide. If you are confident enough, you can try install MySQL, use the framework database `nba.sql`, then try the database commands, but I cannot guarantee they will work at this stage.
In other words, betting commands do not work by default as they require installing MySQL.
  
# Feature & Discord Command List
Below are a few of the available features. Use /help on Discord to view more.
  
  - /help
<img src="https://user-images.githubusercontent.com/98583013/218332097-5a4c1f3e-17ef-46f6-ab30-ee7ac1b02c0a.png" width="500">

  
 - /scores
<img src="https://user-images.githubusercontent.com/98583013/218332251-327ce266-9a23-4f5d-8f2d-04d969bd4241.png" width="500">

  
 - /bet 
<img src="https://user-images.githubusercontent.com/98583013/218332655-f3566e58-119d-410f-beba-53f0248d91f5.png" width="500">

 - /news
<img src="https://user-images.githubusercontent.com/98583013/218332494-07eaba32-1c58-450c-adea-acdd3ab6917f.png" width="500">


 - /compare-players
<img src="https://user-images.githubusercontent.com/98583013/218332571-5da0b2e2-e17b-4757-9211-b5d36a4d160e.png" width="500">



# How to Make a Contribution
1. Find something to work on: View open issues on github or join our [support server](https://discord.gg/njhVCmF) and view the todo channel to find potential features to implement - or create your own idea.
2. Build locally: Follow installation instructions to run NBABot on your local machine.
3. Make changes: Write code locally, testing as you go.
4. Update documentation: Adjust README.md to correspond to any additional features added.
5. Submit a pull request: Add a description of changes and create a pull request to the main repository.
  
# How to Support Us
NBABot, as much as it is a passion project, is very time consuming and involves a lot of upfront cost. We hope to not only one day be able to pay for the server costs (around $90 USD per month), but also further development and in bringing on other experts to help us with Web Development or marketing.

If you want to support us monetarily, you can support on [Patreon](https://www.patreon.com/nbabot).

Otherwise, you can vote for us on [top.gg](https://top.gg/bot/544017840760422417), and you'll also recieve $10 in the virtual betting system!

# License

Released under the [GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html) license.
