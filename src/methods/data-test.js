const fetch = require(`node-fetch`);
const config = require(`../config.json`);
const fs = require(`fs`);

// https://stats.nba.com/stats/playerprofilev2?LeagueID=&PerMode=PerGame&PlayerID=1631095
fetch(`https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=2022-23&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`, {
    headers: config.headers
}).then(async res => {
    let a = await res.text();
    a = JSON.parse(a);

    /*
    let lastPlayed = require(`../assets/players/nba/last-played.json`);

    a = a.resultSets[0].rowSet;

    for (var i = 0; i < a.length; i++) {
      lastPlayed[a[i][0].toString()] = 2022;
    }

    fs.writeFileSync(`./last-played-nba.json`, JSON.stringify(lastPlayed), err => {
      if (err) throw err;
    });
    */

    console.log(JSON.stringify(a));
    
});