import dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function test() {
  const branchId = "69cb755611501727ed6ec9cb";
  const url = `http://localhost:5000/api/products?branchId=${branchId}&limit=10000&mini=true`;
  console.log("Fetching from:", url);

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) {
      console.log("API returned success false:", data);
      return;
    }

    const target = data.data.find(p => p.name.includes("CHIC PERI PERI KURKURAE"));
    if (target) {
      console.log("Found product in mini response:");
      console.log(JSON.stringify(target, null, 2));
    } else {
      console.log("Product not found in mini response!");
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test();
