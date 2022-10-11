const fetch = require(`node-fetch`);

let date = `20221005`;

/* fetch(`https://www.nba.com/games?date=${date}`)
    .then(res => res.text())
    .then(h => {

        h = h.substring(h.search(`{"props":`), h.length);

        h = h.substring(0, h.search(`}</script></body>`) + 1);

        let j = JSON.parse(h);

        console.log(j);


    }) */

fetch(`https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json`)
    .then(res => res.json())
    .then(json => {
        let dates = json.leagueSchedule.gameDates;
        for (var i = 0; i < dates.length; i++) {
            let date = dates[i].gameDate;
            let d = new Date(date);
            d = d.toISOString().substring(0, 10).split(`-`).join(``);
        } 
    })