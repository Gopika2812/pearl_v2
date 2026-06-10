async function main() {
  const res = await fetch('http://localhost:5000/api/sales-orders?branchId=69cc1d573493c36f8cb7b419&search=Z1SO/088/26-27');
  const data = await res.json();
  const order = data[0];
  console.log("items:", JSON.stringify(order.items, null, 2));
}

main().catch(console.error);
