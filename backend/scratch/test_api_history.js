async function test() {
  try {
    const url = "http://localhost:5000/api/invoices/history?branchId=65fa3a5c12bb2f7868bf0001&limit=5";
    console.log("Fetching from:", url);
    const res = await fetch(url);
    const data = await res.json();
    console.log("Response OK:", res.ok);
    if (data.history && data.history.length > 0) {
      console.log("First item sample:");
      console.log("invoiceNumber:", data.history[0].invoiceNumber);
      console.log("date:", data.history[0].date);
      console.log("createdAt:", data.history[0].createdAt);
    } else {
      console.log("No history entries found. Full response keys:", Object.keys(data));
      if (data.message) console.log("Message:", data.message);
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

test();
