import fetch from "node-fetch";

async function run() {
  console.log("Calling balances endpoint...");
  const response = await fetch("http://localhost:5000/api/customers/balances", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      customerIds: ["69cc827090a268b9a0b7bf0c"],
      branchId: "69cb755611501727ed6ec9cb"
    })
  });
  
  const data = await response.json();
  console.log("Endpoint response:", JSON.stringify(data, null, 2));
}

run().catch(console.error);
