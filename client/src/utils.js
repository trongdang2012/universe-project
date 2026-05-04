/**
 * Format a number with thousand-separator commas (e.g. 1000 → 1,000)
 * @param {number|string} n
 * @returns {string}
 */
export const fmtUC = (n) => {
  if (n === null || n === undefined || n === '') return '0';
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return num.toLocaleString('en-US');
};
