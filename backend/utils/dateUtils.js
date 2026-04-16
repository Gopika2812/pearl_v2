/**
 * Utility for Indian Standard Time (IST) Date handling
 * India is UTC +5:30
 */

/**
 * Returns a UTC Date object representing 00:00:00 IST for a given date string or date object.
 * IST 00:00:00 is UTC 18:30:00 of the previous day.
 */
export const getISTStartOfDay = (dateInput = null) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  // Set to midnight UTC
  const start = new Date(date.setUTCHours(0, 0, 0, 0));
  // Subtract 5 hours and 30 minutes to get the UTC time equivalent of IST 00:00:00
  // Note: If using ISO string like "2026-04-16", new Date("2026-04-16") is 00:00:00 UTC.
  // We subtract 330 minutes.
  start.setMinutes(start.getMinutes() - 330);
  return start;
};

/**
 * Returns a UTC Date object representing 23:59:59.999 IST for a given date.
 */
export const getISTEndOfDay = (dateInput = null) => {
  const start = getISTStartOfDay(dateInput);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return end;
};

/**
 * Formats a Date object to "DD-MM-YYYY HH:mm" in IST format for logging/display
 */
export const formatISTDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};
