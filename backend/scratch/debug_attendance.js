import axios from "axios";

const run = async () => {
  const lat = 8.730056275788932;
  const lng = 77.74614652734583;
  
  try {
    const nomRes = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { "User-Agent": "ERP_Pearls_Test" }
    });
    console.log("=== NOMINATIM ===");
    console.log(JSON.stringify(nomRes.data, null, 2));
  } catch (e) {
    console.error("Nominatim failed:", e.message);
  }

  try {
    const bdcRes = await axios.get(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    console.log("=== BIG DATA CLOUD ===");
    console.log(JSON.stringify(bdcRes.data, null, 2));
  } catch (e) {
    console.error("BigDataCloud failed:", e.message);
  }
};

run();
