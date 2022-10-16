// Methods
const query = require(`./query.js`);

module.exports = async (con, table, IDName, ID) => {
    return new Promise(async resolve => {
        let a = await query(con, `SELECT * FROM ${table} WHERE ${IDName} = "${ID}";`), e = true;
        console.log(a);
        if (!a) e = false;
        if (a.length == 0) e = false;
        if (!e) resolve(null);

        a = a[0];
        resolve(a);
    });
}