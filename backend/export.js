import { MongoClient } from "mongodb";
import fs from "fs";

const uri = "mongodb+srv://gopikap2812_db_user:3EprufLKuDVKIdo3@branchesdb.njfcfju.mongodb.net/pearls_erp";

async function run() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db("pearls_erp");
        const collection = db.collection("products");

        const data = await collection.find({}).toArray();

        fs.writeFileSync("products.json", JSON.stringify(data, null, 2));
        console.log("✅ Exported successfully!");
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

run();