const query = require(`../methods/database/query.js`);

module.exports = async (con) => {
    delete require.cache[require.resolve(`../cache/today.json`)];
    let currentDate = require(`../cache/today.json`).links.currentDate;
    let a = await query(con, `SELECT * FROM stats WHERE Date = "${currentDate}";`);
    a = a[0];
    if (!a?.buttons && a?.buttons != 0) await query(con, `UPDATE stats SET buttons = 1, Total = Total + 1 WHERE Date = "${currentDate}";`);
    else await query(con, `UPDATE stats SET buttons = buttons + 1, Total = Total + 1 WHERE Date = "${currentDate}";`);
}