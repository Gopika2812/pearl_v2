import axios from "axios";

/**
 * Zoho Books Integration Service
 * 
 * Uses Zoho Books API to create expenses for paid salaries.
 */

const getAccessToken = async () => {
  try {
    const response = await axios.post("https://accounts.zoho.in/oauth/v2/token", null, {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: "refresh_token",
      },
    });
    return response.data.access_token;
  } catch (error) {
    console.error("Error fetching Zoho Access Token:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with Zoho Books");
  }
};

export const createSalaryExpense = async ({ employeeName, amount, month, employeeId }) => {
  try {
    const accessToken = await getAccessToken();
    const organizationId = process.env.ZOHO_ORG_ID;

    // 1. Find or Use the "Salary/Wages" Category ID
    // In a real app, you might want to fetch account_id for "Salary/Wages"
    // For now, we'll assume a configurable ID or use a placeholder if not provided
    const accountId = process.env.ZOHO_SALARY_ACCOUNT_ID; 

    const expenseData = {
      account_id: accountId,
      date: new Date().toISOString().split("T")[0],
      amount: amount,
      description: `Salary for ${employeeName} - Month: ${month}`,
      reference_number: `${employeeId}-${month}`,
      payment_mode: "Bank Transfer", // Default or configurable
    };

    const response = await axios.post(
      `https://www.zohoapis.in/books/v3/expenses?organization_id=${organizationId}`,
      expenseData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error creating Zoho Expense:", error.response?.data || error.message);
    throw error;
  }
};
