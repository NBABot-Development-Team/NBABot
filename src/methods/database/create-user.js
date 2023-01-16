module.exports = async (con, table, ID) => {
    return new Promise(resolve => {
        switch (table) {
            case `users`:
                // Notes
                // Odds - d (decimal) or u (US moneyline)
                // Date format - u (us - mmddyyyy), i (international ddmmyyyy)
                con.query(`INSERT INTO users VALUES ("${ID}", 10.00, "NBA", "Use /settings description to set your description", 0, 0, "n", "y", "", "d", "u", NULL, "0", "y", NULL, "y", "", "e", "");`, async (e, r, f) => {
                    if (e) console.log(e);
                    await require(`../update-peak-positions.js`)(con, ID);
                    resolve();
                });
                break;

            case `bets`:
                con.query(`INSERT INTO bets (ID) VALUES ("${ID}");`, (e, r, f) => {
                    if (e) console.log(e);
                    resolve();
                });
                break;
        }
    });
}