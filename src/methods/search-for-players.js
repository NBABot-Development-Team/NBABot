module.exports = (input) => {
    // Assets
    const player_names = require(`../assets/players/all/names.json`);
    const player_ids = require(`../assets/players/all/ids.json`);

    input = input.toLowerCase();

    // Found an exact match?
    if (player_ids[input]) {
        return [player_ids[input]];
    }

    // No exact match, so going through all players
    let possible = [];
    player_loop: for (var id in player_names) {
        let player_words = player_names[id].toLowerCase().split(` `);
        let input_words = input.split(` `);

        for (var i = 0; i < input_words.length; i++) {
            if (player_words.includes(input_words[i])) {
                if (!possible.includes(id)) possible.push(id);
                continue player_loop;
            }
        }
    }

    // Seeing if there's nothing
    if (possible.length == 0) return;

    return possible;
}