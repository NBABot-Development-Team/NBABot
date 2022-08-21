module.exports = async (con, query) => {
    return new Promise(resolve => {
        con.query(query, (e, r, f) => {
            if (e) console.log(e);
            resolve(r);
        });
    })
};