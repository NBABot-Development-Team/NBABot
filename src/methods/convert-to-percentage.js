module.exports = (a, b) => {
	if (b == 0) return `0%`;
	return `${((parseInt(a)/parseInt(b)) * 100).toFixed(1)}%`;
}
