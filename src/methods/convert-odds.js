// convert (odds) to (type), decimal is 2 dp float and us is string formatted int
module.exports = (odds, type) => {
    odds = parseFloat(odds);

    // Sort out which type to be converted to 
    switch (type.toLowerCase()) { 
        case `d`:
        case `decimal`:
            if (odds > 0) {
                return (1 + (odds / 100)).toFixed(2); 
            } else {
                return (1 - (100 / odds)).toFixed(2);
            }

        case `us`:
        case `u`:
        case `m`:
        case `money`:
        case `moneyline`:
            if (odds >= 2) {
                return `+${parseInt(100 * (odds - 1))}`;
            } else {
                return parseInt(100 / (1 - odds)).toString();
            }
            break;

        default:
            return null;
    }
}