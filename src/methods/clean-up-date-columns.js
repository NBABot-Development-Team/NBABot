const query = require(`./database/query.js`);

module.exports = async (con) => {
    let columns = await query(con, `SHOW COLUMNS FROM bets;`);

    columnLoop: for (var i = 0; i < columns.length; i++) {
        if (columns[i].Field == `ID`) continue columnLoop;
        let date = columns[i].Field.split(`d`).join(``);
        let dateObject = new Date(`${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`); 

        // Checking if the column is newer than 1 week, if so, continue columnLoop
        if (dateObject.getTime() + 1000 * 60 * 60 * 24 * 7 >= new Date().getTime()) continue columnLoop;

        // Checking if there are any bets still there in that column
        let bets = await query(con, `SELECT d${date} FROM bets WHERE d${date} IS NOT NULL;`);
        let allNull = true;
        betLoop: for (var j = 0; j < bets.length; j++) {
            if (bets[i][`d${date}`]) {
                allNull = false;
                break betLoop;
            }
        }

        if (allNull) {
            await query(con, `ALTER TABLE bets DROP COLUMN d${date};`);
        }
    }
}