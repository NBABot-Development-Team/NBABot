// Methods
const query = require(`../methods/database/query.js`);

module.exports = async (con, id = null) => {
    let all;
    if (!id) {
        all = await query(con, `SELECT ID, Balance, PeakPosition, @row := @row + 1 AS serial_num FROM users CROSS JOIN (SELECT @row := 0) r ORDER BY Balance DESC`);
    } else {
        all = await query(con, `SELECT * FROM (SELECT ID, Balance, PeakPosition, @row := @row + 1 AS serial_num FROM users CROSS JOIN (SELECT @row := 0) r ORDER BY Balance DESC) temp WHERE ID = "${id}";`);
    }

    let changed = 0;
    for (var i = 0; i < all.length; i++) {
        if (!all[i].PeakPosition) {
            await query(con, `UPDATE users SET PeakPosition = "${all[i].serial_num}-${all[i].PeakPosition.split(`-`)[1]}" WHERE ID = "${all[i].ID}";`);
            changed++;
        } else if (all[i].serial_num < parseInt(all[i].PeakPosition.split(`-`)[0])) {
            await query(con, `UPDATE users SET PeakPosition = "${all[i].serial_num}-${all[i].PeakPosition.split(`-`)[1]}" WHERE ID = "${all[i].ID}";`);
            changed++;
        }
        if (all[i].Balance > parseFloat(all[i].PeakPosition.split(`-`)[1])) {
            await query(con, `UPDATE users SET PeakPosition = "${all[i].PeakPosition.split(`-`)[0]}-${all[i].Balance}" WHERE ID = "${all[i].ID}";`);
        }
        if ((i % 100 == 0 || i == all.length) && !id) console.log(`${changed}/${i}/${all.length}`);
    }
}