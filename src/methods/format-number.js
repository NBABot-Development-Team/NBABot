module.exports = (n) => {
    if (n > 10 && n < 20) return `${n}th`;
    n = n.toString();
    let s = n;
    switch(n[n.length - 1]) {
        case `1`:
            s += `st`;
            break;

        case `2`:
            s += `nd`;
            break;

        case `3`:
            s += `rd`;
            break;

        default:
            s += `th`;
            break;
    }
    return s;
}