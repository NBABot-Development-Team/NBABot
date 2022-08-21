module.exports = (e) => {
	// parseInt(e % 1e3 / 100);

    /* var n = parseInt(e / 1e3 % 60), // Seconds
        r = parseInt(e / 6e4 % 60), // Minutes
        s = parseInt(e / 36e5 % 24), // Hours
        t = parseInt(e / 864e5 % 7), // Days
        u = parseInt(e / 6048e5); // Weeks
    
    let str = ``;
    if (u > 0) str += `${u} week${(u > 1) ? 's' : ''}-`;
    if (t > 0) str += `${t} day${(t > 1) ? 's' : ''}-`;
    if (s > 0) str += `${s} hour${(s > 1) ? 's' : ''}-`;
    if (r > 0) str += `${r} minute${(r > 1) ? 's' : ''}`;
    if (n > 0 && r == 0) str += `${n} second${(n > 1) ? 's' : ''}`;

    let arr = str.split(`-`);

    if (arr.length > 1) arr[arr.length - 1] = `and ${arr[arr.length - 1]}`;
    str = `${arr.join(`, `)}.`;
    return str; */

    return `<t:${parseInt(e/1000)}:R>`;
}; 
