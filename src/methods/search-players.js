// Assets
const names = {
    nba: require(`../assets/players/nba/names.json`),
    bdl: require(`../assets/players/bdl/names.json`),
};
const ids = {
    nba: require(`../assets/players/nba/ids.json`),
    bdl: require(`../assets/players/bdl/ids.json`),
};

module.exports = (input, useBDL = true) => {
    let found = false;
    let possible = { nba: {}, bdl: {} };
    let details = { source: null, id: null, name: null };
    let namesAlreadyPushed = [];

    // Certain search for nba
    if (ids.nba[input.toLowerCase()] && !found) {
        possible.nba[ids.nba[input.toLowerCase()]] = input.length;
        return [`nba`, ids.nba[input.toLowerCase()]];
        found = true;
    }

    // Certain search for bdl
    if (!found) {
        if (ids.bdl[input.toLowerCase()] && useBDL) {
            possible.bdl[ids.bdl[input.toLowerCase()]] = input.length;
            return [`bdl`, ids.bdl[input.toLowerCase()]];
            found = true;
        }
    }

    if (!found) {
        // Now doing full search
        sourceLoop: for (var key in possible) {
            if (key == `bdl` && !useBDL) continue sourceLoop;
            nameLoop: for (var name in ids[key]) {
                if (namesAlreadyPushed.includes(name)) continue nameLoop;
                let names = name.split(` `);
                namesLoop: for (var i = 0; i < names.length; i++) {
                    let requests = input.toLowerCase().split(` `);
                    if (requests.includes(names[i].toLowerCase())) {
                        if (!possible[key][ids[key][name].toString()]) possible[key][ids[key][name].toString()] = 1;
                        else possible[key][ids[key][name].toString()]++;
                        namesAlreadyPushed.push(name);
                    }
                }
            }
        }
    }

    if (Object.keys(possible.nba).length + Object.keys(possible.bdl).length == 0) {
        return null;
    }

    if (Object.keys(possible.nba).length + Object.keys(possible.bdl).length == 1) {
        return [(Object.keys(possible.nba).length == 1) ? `nba` : `bdl`, Object.keys(possible[(Object.keys(possible.nba).length == 1) ? `nba` : `bdl`])[0]];
    } else {
        // Seeing if one is more than the others
        let scores = { nba: Object.values(possible.nba), bdl: Object.values(possible.bdl) };
        let top = 0, count = 0, location = [];
        for (var key in scores) {
            for (var i = 0; i < scores[key].length; i++) {
                if (scores[key][i] > top) {
                    top = scores[key][i];
                    count = 1;
                    location = [key, i];
                } else if (scores[key][i] == top) {
                    count++;
                }
            }
        }

        if (count > 1 || top == 0 || !location) { // Uncertain
            return possible;
        }

        return [location[0], Object.keys(possible[location[0]])[location[1]]];
    }
}