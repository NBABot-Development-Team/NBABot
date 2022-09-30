const fetch = require(`node-fetch`);

fetch(`https://api.beta.tab.com.au/v1/tab-info-service/sports/Basketball/competitions/NBA?jurisdiction=NSW&numTopMarkets=5`)
    .then(res => res.text())
    .then(h => console.log(h));