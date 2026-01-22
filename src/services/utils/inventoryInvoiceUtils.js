export const getFinancialYear = () => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  
  // Financial Year starts from April 
  const currentYear = year.toString().slice(-2);
  const nextYear = (year + 1).toString().slice(-2);
  const prevYear = (year - 1).toString().slice(-2);

  return month >= 4 ? `${currentYear}-${nextYear}` : `${prevYear}-${currentYear}`;
};

export const generateInvoiceID = (prefix, counter) => {
  const fy = getFinancialYear();
  const paddedCounter = String(counter).padStart(3, "0"); // e.g. 001 
  return `${prefix.toUpperCase()}/${paddedCounter}/${fy}`;
};