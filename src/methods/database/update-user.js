module.exports = async (con, table, ID, user) => {
    return new Promise(resolve => {
        let query = [];
        for (var key in user) {
            if (key == `ID`) continue;
            if ([`Balance`, `Correct`, `Wrong`].includes(key)) query.push(`${key} = ${user[key]}`);
            else query.push(`${key} = "${user[key]}"`);
        }
        query.join(`, `);
        query = `UPDATE ${table} SET ${query} WHERE ID = "${ID}";`;

        con.query(query, (e, r, f) => {
            if (e) console.log(e);
            resolve();
        })

    });
}