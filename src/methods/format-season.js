module.exports = (season) => {
    season = season.split(`-`);

    switch(season.length) {
        case 0:
            return;
            break;

        case 1:
        case 2:
            season = parseInt(season[0]);

            // Getting seasonScheduleYear
            delete require.cache[require.resolve(`../cache/today.json`)];
            let seasonScheduleYear = require(`../cache/today.json`).seasonScheduleYear;

            if (season >= 1979 && season <= seasonScheduleYear) return season;
            break;
    }
};