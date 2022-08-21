module.exports = async (con, table, ID) => {
    return new Promise(resolve => {
        con.query(`SELECT * FROM ${table} WHERE ID = "${ID}";`, (e, r, f) => {
            if (e) console.log(e);
            resolve(r);
        });
    });
}