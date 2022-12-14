const fetch = require(`node-fetch`);
const fs = require(`fs`);

const getJSON = require(`./get-json.js`);

let lastPlayed = require(`../assets/players/bdl/last-played.json`);
let changed = {};

let lastRequested = new Date().getTime();

let seasons = [2019, 2020, 2021, 2022];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function update() {
    // pre-lim
    let total = Object.keys(lastPlayed).length;

    let counter = 0;

    playerLoop: for (var key in lastPlayed) {
        counter++;
        let start;
        seasonLoop: for (var i = 0; i < seasons.length; i++) {
            if (seasons[i] == lastPlayed[key]) {
                start = i + 1; 
                break seasonLoop;
            }
        }

        let latest = lastPlayed[key];
        for (var i = start; i < seasons.length; i++) {
            let now = new Date().getTime();
            if (now - lastRequested < 1000) {
                await sleep(lastRequested + 1000 - now);
            }
            let json = await getJSON(`https://www.balldontlie.io/api/v1/season_averages?season=${seasons[i]}&player_ids[]=${key}`);
            lastRequested = new Date().getTime();
            
            let dataExists = true;
            if (!json) dataExists = false;
            else if (!json.data) dataExists = false;
            else if (!json.data[0]) dataExists = false;

            if (dataExists) {
                latest = seasons[i];
            } else break;
        }
        if (latest != lastPlayed[key]) {
            lastPlayed[key] = latest;
            console.log(`${key}: ${latest}, ${counter}/${total}`);
        }


        fs.writeFileSync(`./last-played.json`, JSON.stringify(lastPlayed), err => {
            if (err) throw err;
        });
    }
}

async function refresh() {
    let a = {"2":2021,"3":2021,"4":2021,"6":2021,"8":2021,"9":2021,"10":2021,"12":2021,"15":2021,"16":2020,"17":2021,"18":2021,"19":2021,"20":2021,"21":2021,"22":2021,"23":2020,"24":2021,"27":2021,"28":2021,"30":2021,"31":2021,"32":2021,"33":2021,"35":2020,"36":2021,"37":2021,"38":2021,"41":2021,"42":2021,"44":2021,"45":2021,"46":2021,"48":2021,"49":2021,"51":2021,"52":2021,"53":2021,"54":2021,"56":2021,"57":2021,"58":2021,"59":2021,"60":2021,"61":2021,"62":2021,"65":2021,"66":2021,"68":2021,"69":2021,"70":2021,"72":2021,"73":2021,"74":2021,"75":2021,"76":2021,"77":2021,"79":2021,"81":2021,"83":2021,"85":2021,"86":2020,"87":2021,"89":2021,"91":2021,"97":2021,"98":2021,"100":2021,"101":2021,"102":2021,"104":2021,"105":2021,"106":2021,"108":2021,"110":2021,"112":2021,"114":2021,"115":2021,"117":2021,"118":2021,"120":2021,"123":2020,"125":2021,"128":2021,"129":2021,"130":2021,"131":2021,"132":2021,"134":2021,"135":2021,"136":2021,"137":2021,"138":2020,"139":2021,"143":2020,"144":2021,"145":2021,"146":2021,"147":2021,"151":2020,"153":2021,"154":2020,"156":2020,"157":2020,"158":2021,"159":2021,"160":2021,"161":2021,"163":2021,"165":2021,"166":2021,"167":2021,"168":2021,"169":2020,"171":2021,"172":2021,"173":2021,"174":2021,"175":2021,"176":2021,"177":2021,"178":2021,"180":2021,"182":2021,"184":2021,"185":2021,"187":2021,"188":2021,"189":2021,"191":2021,"192":2021,"193":2021,"194":2021,"196":2021,"197":2021,"199":2021,"200":2021,"201":2021,"202":2021,"203":2021,"204":2021,"206":2021,"207":2021,"210":2021,"211":2021,"212":2021,"213":2021,"214":2021,"215":2021,"216":2020,"217":2021,"218":2021,"219":2021,"220":2021,"221":2021,"222":2021,"223":2021,"224":2021,"225":2021,"226":2021,"227":2021,"228":2021,"230":2021,"231":2021,"233":2021,"234":2021,"235":2021,"236":2021,"237":2021,"240":2021,"242":2021,"243":2021,"244":2021,"246":2021,"247":2021,"248":2021,"249":2021,"250":2021,"251":2021,"252":2021,"253":2021,"254":2021,"257":2021,"259":2021,"260":2021,"261":2021,"264":2020,"265":2021,"267":2021,"268":2021,"269":2021,"270":2020,"272":2021,"273":2021,"274":2020,"275":2020,"277":2021,"278":2021,"282":2021,"283":2021,"284":2021,"285":2021,"286":2021,"288":2021,"290":2021,"295":2020,"296":2021,"297":2021,"299":2021,"301":2021,"303":2021,"304":2021,"305":2021,"306":2021,"307":2021,"308":2021,"309":2021,"313":2021,"314":2021,"315":2021,"318":2021,"319":2021,"320":2021,"322":2021,"324":2021,"326":2021,"328":2021,"329":2021,"330":2021,"334":2021,"335":2020,"337":2021,"338":2021,"339":2021,"340":2021,"343":2021,"344":2021,"345":2021,"347":2021,"349":2021,"350":2021,"351":2021,"353":2021,"354":2021,"356":2021,"357":2021,"358":2021,"359":2021,"360":2021,"362":2021,"365":2021,"366":2021,"367":2021,"368":2021,"369":2021,"370":2021,"371":2021,"373":2021,"375":2021,"376":2021,"377":2021,"378":2021,"379":2021,"380":2021,"383":2021,"386":2021,"387":2021,"389":2020,"391":2021,"393":2021,"394":2020,"395":2020,"397":2021,"398":2021,"399":2021,"400":2021,"401":2021,"402":2021,"403":2021,"404":2021,"405":2021,"406":2021,"407":2020,"408":2021,"409":2021,"410":2020,"413":2021,"414":2021,"415":2020,"416":2021,"417":2021,"419":2021,"420":2021,"421":2021,"422":2021,"426":2021,"428":2021,"432":2020,"434":2021,"435":2020,"436":2021,"439":2021,"440":2021,"441":2021,"444":2021,"445":2020,"446":2020,"447":2021,"450":2021,"452":2021,"455":2021,"456":2021,"457":2021,"458":2021,"459":2020,"460":2021,"462":2021,"464":2021,"465":2021,"468":2021,"469":2020,"470":2021,"472":2021,"473":2021,"474":2021,"475":2021,"476":2021,"480":2021,"481":2021,"484":2021,"485":2021,"486":2021,"487":2021,"489":2021,"490":2021,"491":2021,"493":2021,"2080":2020,"2099":2020,"2148":2021,"2158":2020,"2175":2021,"2189":2021,"3089":2021,"3091":2021,"50661":2021,"50927":2020,"666393":2021,"666400":2021,"666423":2021,"666429":2021,"666442":2021,"666446":2021,"666451":2021,"666453":2021,"666454":2021,"666459":2021,"666463":2021,"666464":2021,"666467":2021,"666468":2021,"666474":2021,"666476":2021,"666486":2021,"666489":2021,"666505":2021,"666508":2021,"666509":2021,"666511":2021,"666517":2021,"666523":2021,"666530":2021,"666541":2021,"666543":2021,"666551":2021,"666552":2021,"666560":2021,"666564":2021,"666570":2021,"666577":2021,"666581":2021,"666584":2021,"666598":2021,"666604":2021,"666608":2021,"666609":2021,"666611":2020,"666616":2021,"666626":2021,"666633":2021,"666641":2021,"666647":2021,"666650":2021,"666656":2021,"666672":2021,"666675":2021,"666676":2021,"666679":2021,"666682":2021,"666692":2021,"666698":2021,"666703":2021,"666713":2021,"666716":2021,"666720":2021,"666729":2021,"666743":2021,"666747":2021,"666748":2021,"666750":2021,"666751":2021,"666754":2021,"666755":2021,"666762":2021,"666767":2021,"666783":2020,"666786":2021,"666788":2021,"666794":2021,"666809":2021,"666818":2021,"666821":2021,"666824":2021,"666831":2021,"666837":2021,"666840":2021,"666846":2020,"666848":2021,"666849":2021,"666860":2021,"666871":2021,"666873":2021,"666881":2021,"666892":2021,"666894":2021,"666897":2021,"666899":2021,"666900":2020,"666908":2021,"666919":2021,"666923":2021,"666925":2021,"666930":2021,"666940":2021,"666950":2021,"666952":2021,"666953":2021,"666956":2021,"666960":2021,"666965":2021,"666969":2020,"666971":2021,"666975":2021,"667302":2020,"667378":2021,"1358055":2021,"1567838":2021,"1603383":2021,"3547095":2021,"3547163":2021,"3547164":2021,"3547169":2021,"3547197":2021,"3547207":2021,"3547215":2021,"3547238":2021,"3547239":2021,"3547241":2021,"3547242":2021,"3547243":2021,"3547244":2021,"3547245":2021,"3547246":2021,"3547247":2021,"3547248":2021,"3547249":2021,"3547250":2021,"3547251":2021,"3547252":2021,"3547253":2021,"3547254":2021,"3547255":2021,"3547256":2021,"3547257":2021,"3547258":2021,"3547259":2021,"3547260":2021,"3547262":2021,"3547263":2021,"3547264":2021,"3547265":2021,"3547266":2021,"3547267":2021,"3547268":2021,"3547269":2021,"3547270":2021,"3547271":2021,"3547272":2021,"3547273":2021,"3547274":2021,"3547275":2021,"3547276":2021,"3547277":2021,"3547278":2021,"3547279":2021,"3547280":2021,"3547281":2021,"3547282":2021,"3547283":2021,"3547284":2021,"3547285":2021,"3547286":2021,"3547287":2021,"3547288":2021,"3547289":2021,"3547290":2021,"3547291":2021,"3547293":2021,"3547294":2021,"3547295":2021,"3547296":2021,"3547297":2021,"3547298":2021,"3547299":2021,"3547300":2021,"3547301":2021,"3547302":2021,"3547304":2021,"3547305":2021,"3547306":2021,"4196999":2021,"4197105":2021,"4197192":2021,"4197197":2021,"4197232":2021,"4197307":2021,"4197356":2021,"4197384":2021,"4197387":2021,"4197388":2021,"4197389":2021,"7155648":2021,"9051997":2021,"9177971":2021,"9318184":2021,"9338307":2021,"9530711":2021};
    for (var key in a) {
        if (lastPlayed[key] != a[key]) {
            lastPlayed[key] = a[key];
        }
    }
    fs.writeFileSync(`./last-played.json`, JSON.stringify(lastPlayed), err => {
        if (err) throw err;
    });
}

function spliceIntoChunks(arr, chunkSize) {
    const res = [];
    while (arr.length > 0) {
        const chunk = arr.splice(0, chunkSize);
        res.push(chunk);
    }
    return res;
}

async function update2() {
    let seasons = {};
    let names = require(`../assets/players/bdl/names.json`);
    let lastReq = new Date().getTime();

    let maxPlatoonSize = 25;
    let delay = 1200;
    let s = [2018, 2019, 2020, 2021, 2022];
    let defaultYear = s[s.length - 1];

    for (var key in names) {
        if (!lastPlayed[key]) lastPlayed[key] = defaultYear;
        if (!seasons[lastPlayed[key]]) seasons[lastPlayed[key]] = [];
        seasons[lastPlayed[key]].push(key);
    }

    // From 2018 onwards
    for (var i = 0; i < s.length; i++) {
        if (!seasons[s[i]]) continue;
        if (seasons[s[i]].length == 0) continue;
        let a = spliceIntoChunks(seasons[s[i]], maxPlatoonSize);

        for (var j = 0; j < a.length; j++) { // 25 platoon
            yearCheckLoop: for (var k = s[i] + 1; k < defaultYear + 1; k++) {
                console.log(`Year: ${s[i]}, Platoon: ${j}/${a.length}, Checking Year: ${k}`);
                let base = `https://www.balldontlie.io/api/v1/season_averages?season=${k}`;
                for (var l = 0; l < a[j].length; l++) {
                    base += `&player_ids[]=${a[j][l]}`;
                }
                
                let now = new Date().getTime();
                if (now - lastReq < delay) {
                    await sleep(lastReq + delay - now);
                }
                let json = await getJSON(base);
                lastReq = new Date().getTime();

                if (!json) continue yearCheckLoop;
                if (!json.data) continue yearCheckLoop;
                if (!json.data.length) continue yearCheckLoop;

                for (var m = 0; m < json.data.length; m++) {
                    if (!lastPlayed[json.data[m].player_id]) {
                        lastPlayed[json.data[m].player_id] = k;
                    } else {
                        if (k > lastPlayed[json.data[m].player_id]) {
                            lastPlayed[json.data[m].player_id] = k;
                        }
                    }
                }
            }

            fs.writeFileSync(`./last-played.json`, JSON.stringify(lastPlayed), err => {
                if (err) throw err;
            });
        }
    }
}

update2();