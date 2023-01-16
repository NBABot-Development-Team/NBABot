// Libraries
const moment = require(`moment-timezone`);

let timezones = moment.tz.names();
let t = moment.tz("7:00 pm", "h:mm a", "America/New_York");
console.log(moment.tz(t.utc(), "Pacific/Auckland").format("h:mm a z"));