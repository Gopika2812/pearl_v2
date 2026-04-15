export function getFinancialYear(dateInput = null) {
  const now = dateInput ? new Date(dateInput) : new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // Jan = 1

  // Financial year starts in April
  if (month >= 4) {
    // Format: 25-26 (short format)
    const shortYear = String(year).slice(-2);
    const shortNextYear = String(year + 1).slice(-2);
    return `${shortYear}-${shortNextYear}`;
  } else {
    // Format: 25-26 (short format)
    const shortYear = String(year - 1).slice(-2);
    const shortCurrentYear = String(year).slice(-2);
    return `${shortYear}-${shortCurrentYear}`;
  }
}
