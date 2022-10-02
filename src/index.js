// Libraries
const Discord = require(`discord.js`);

// JSON files
const config = require(`./config.json`);

// Sharding
const manager = new Discord.ShardingManager(`./bot.js`, {
    token: config.token,
    totalShards: "auto"
});

manager.spawn();
manager.on(`shardCreate`, async (shard) => { 
	console.log(`[${shard.id}] Shard launched (NBABot)`);
	shard.on(`ready`, () => {
		shard.send({type: "shardId", data: {shardId: shard.id}});
	});
	shard.on(`error`, (error) => {
		console.error(error);
	});
});
