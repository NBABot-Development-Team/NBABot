const canvas = require(`canvas`);
const fetch = require(`node-fetch`);
const fs = require(`fs`);

module.exports = async (url, team = null) => {
    return new Promise(resolve => {
        fetch(url)
            .then(res => res.json())
            .then(async json => {
                let a = json.game.actions;

                const width = 1455, height = 1365;

                const c = canvas.createCanvas(width, height);
                const x = c.getContext(`2d`);

                let court = await canvas.loadImage(`./assets/images/court.jpg`);
                let make = await canvas.loadImage(`./assets/images/make.png`);
                let miss = await canvas.loadImage(`./assets/images/miss.png`);

                x.drawImage(court, 0, 0, width, height);

                canvas.registerFont(`./assets/fonts/whitney-500.ttf`, { family: `Whitney` });
                x.fillStyle = "#000000";
                x.font = `65px Whitney`;
                x.fillText(`nbabot.js.org`, 1060, 1330);

                for (var i = 0; i < a.length; i++) {
                    if (!a[i].x || !a[i].y || !a[i].isFieldGoal || !a[i].shotResult) continue;
                    if (team) {
                        if (a[i].teamTricode != team) continue;
                    }

                    if (a[i].x >= 50) {
                        a[i].x = 100 - a[i].x;
                        a[i].y = 100 - a[i].y;
                    }
                    
                    x.drawImage((a[i].shotResult == `Made`) ? make : miss, (100 - a[i].y) * 14.54 - 20, a[i].x * 27.5 - 20, 40, 40); 
                }

                const buffer = c.toBuffer(`image/png`);
                resolve(buffer);
            });
        });
}