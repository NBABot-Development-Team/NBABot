const config = require(`../config.json`);

// Methods
const query = require(`../methods/database/query.js`);

module.exports = {
    updateCommands: async function(ID, con = null) { // Re-syncs commands for a guild ID
        return new Promise(async resolve => {
            // Getting command data
            const commands = [];
            const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    
            let guildResult;
            if (con) {
                guildResult = await query(con, `SELECT * FROM guilds WHERE ID = "${ID}";`), guildExists = true;
                if (!guildResult) guildExists = false;
                else if (guildResult.length == 0) guildExists = false;

                if (guildExists) {
                    guildResult = guildResult[0];
                } else {
                    await query(con, `INSERT INTO guilds VALUES ("${ID}", 1, "y", NULL);`);
                    guildResult = {ID: ID, Version: 1, Betting: `y`};
                }
            }
            if (!guildResult) guildResult = { Betting: `n` };
    
            commandLoop: for (const file of commandFiles) {
                if ((config.commands.database.includes(file.split(`.`)[0]) && !config.runDatabase) || 
                    (guildResult.Betting == `n` && config.commands.betting.includes(file.split(`.`)[0]))) continue commandLoop;
                
                const command = require(`./commands/${file}`);
                commands.push(command.data.toJSON());
            }
    
            const rest = new REST({ version: '9' }).setToken(config.token);
            rest.put(Routes.applicationGuildCommands(config.clientId, ID), { body: commands })
                .then(async () => {
                    resolve(true);
                })
                .catch(err => {
                    // I dont really care if I can't add commands, the server needs to add that
                    resolve(false);
                });
        });
    }
}