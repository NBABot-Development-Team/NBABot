module.exports = (feet, inches) => {
    feet = feet + (inches / 12);
    return (0.3048 * feet);   
}