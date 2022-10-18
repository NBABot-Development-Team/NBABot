const fetch = require(`node-fetch`);

fetch(`https://www.espn.com/nba/standings`)
    .then(res => res.text())
    .then(h => {
        h = h.substring(h.search(`{"app":`), h.length);
        h = h.substring(0, h.search(`};`) + 1); 
        h = JSON.parse(h);
        console.log(h.page.content.standings.groups.groups);
    });