const fetch = require(`node-fetch`);
const config = require(`../config.json`);
const fs = require(`fs`);

// https://stats.nba.com/stats/playerprofilev2?LeagueID=&PerMode=PerGame&PlayerID=1631095
// https://stats.nba.com/stats/playerdashboardbygeneralsplits?DateFrom=&DateTo=&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerID=${id}&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&Split=general&VsConference=&VsDivision=
fetch(`https://stats.nba.com/stats/playerdashboardbygeneralsplits?DateFrom=&DateTo=&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerID=2544&PlusMinus=N&Rank=N&Season=2022-23&SeasonSegment=&SeasonType=Regular%20Season&ShotClockRange=&Split=general&VsConference=&VsDivision=`, {
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