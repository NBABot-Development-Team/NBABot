const canvas = require(`canvas`);
const fetch = require(`node-fetch`);
const fs = require(`fs`);

// Assets
const teamIDs = require(`../assets/teams/ids.json`);

module.exports = async (url, team = null, teamString = null) => {
    return new Promise(resolve => {
        const stats = url.includes(`stats.nba.com`);
        const options = (stats) ? { headers: require(`../config.json`).headers } : {};
        let season, playerID;
        if (stats) {
            season = url.split(`Season=`)[1].substring(0, 4);
            playerID = url.split(`PlayerID=`)[1].split(`&`)[0];
        }

        fetch(url, options)
            .then(async res => await res.json())
            .then(async json => {

                // This stuff might change
                delete require.cache[require.resolve(`../assets/players/all/names.json`)];
                const playerNames = require(`../assets/players/all/names.json`);

                let a = (stats) ? json.resultSets[0].rowSet : json.game.actions;

                const width = 1455, height = 1365;
                const bottom = height/13;
                const borderThickness = 15;

                const c = canvas.createCanvas(width, height + bottom);
                const x = c.getContext(`2d`);

                const court = await canvas.loadImage(`./assets/images/court.png`);
                const make = await canvas.loadImage(`./assets/images/make.png`);
                const miss = await canvas.loadImage(`./assets/images/miss.png`);

                x.drawImage(court, 0, 0, width, height);
                if (playerID) {
                    let headshot;
                    try {
                        headshot = await canvas.loadImage(`https://cdn.nba.com/headshots/nba/latest/1040x760/${playerID}.png`);
                    } catch (e) {
                        // ...
                    }

                    if (headshot) x.drawImage(headshot, borderThickness + 5, height - bottom - 68, 220, 160);
                }

                canvas.registerFont(`./assets/fonts/whitney-500.ttf`, { family: `Whitney` });
                x.fillStyle = "#FFFFFF";
                x.font = `65px Whitney`;
                x.fillText(`nbabot.js.org`, 1060, 1330);
                if (stats && playerID && season) x.fillText(`${playerNames[playerID]} ${season}-${(parseInt(season) + 1).toString().substring(2, 4)} Shot Chart`, borderThickness * 2, height + bottom - borderThickness * 2.5);
                else if (teamString) x.fillText(teamString, borderThickness * 2, height + bottom - borderThickness * 2.5);

                x.fillRect(0, height, borderThickness, bottom);
                x.fillRect(width - borderThickness, height, borderThickness, bottom);
                x.fillRect(0, (height + bottom) - borderThickness, width, borderThickness);

                for (var i = 0; i < a.length; i++) {
                    if (stats) {
                        x.drawImage((a[i][20]) ? make : miss, (a[i][17] * 3 + width/2 - 20), (a[i][18] * 2.9 + 120), 40, 40); 
                    } else {
                        if (!a[i].x || !a[i].y || !a[i].isFieldGoal || !a[i].shotResult) continue;
                        if (team && !stats) {
                            if (a[i].teamTricode != team) continue;
                        }
    
                        if (a[i] instanceof Object) {
                            if (a[i].x >= 50) {
                                a[i].x = 100 - a[i].x;
                                a[i].y = 100 - a[i].y;
                            }
                        }
                        
                        x.drawImage((a[i].shotResult == `Made`) ? make : miss, (100 - a[i].y) * 14.54 - 20, a[i].x * 27.5 - 20, 40, 40);
                    } 
                }

                const buffer = c.toBuffer(`image/png`);
                resolve(buffer);
            });
        });
}