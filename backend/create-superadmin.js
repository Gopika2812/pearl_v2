import mongoose from "mongoose";
import dotenv from "dotenv";
import SuperAdmin from "./models/SuperAdmin.js";

dotenv.config();

// Use MONGO_URI from .env, or fall back to MONGODB_URI, or local
const MONGODB_URI =
  process.env.MONGO_URI || 
  process.env.MONGODB_URI || 
  "mongodb://localhost:27017/pearls_erp";

async function createSuperAdmin() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check if super admin already exists
    const existingSuperAdmin = await SuperAdmin.findOne({
      username: "superadmin",
    });

    if (existingSuperAdmin) {
      console.log("⚠️  SuperAdmin 'superadmin' already exists!");
      console.log("\nExisting SuperAdmin Details:");
      console.log(`- Username: ${existingSuperAdmin.username}`);
      console.log(`- Email: ${existingSuperAdmin.email}`);
      console.log(`- Full Name: ${existingSuperAdmin.fullName}`);
      console.log(`- Role: ${existingSuperAdmin.role}`);
      console.log(`- Status: ${existingSuperAdmin.status}`);
      console.log("\nIf you need to reset passwords, please update manually in MongoDB.");
      await mongoose.connection.close();
      return;
    }

    // Create new super admin
    const superAdmin = new SuperAdmin({
      username: "superadmin",
      password: "SuperAdmin@123", // Will be hashed by pre-save hook
      email: "admin@pearlfoods.com",
      fullName: "System Administrator",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });

    await superAdmin.save();

    console.log("\n✅ SuperAdmin User Created Successfully!\n");
    console.log("🔐 Login Credentials:");
    console.log("- URL: http://localhost:5173/super-admin-login");
    console.log("- Username: superadmin");
    console.log("- Password: SuperAdmin@123");
    console.log("- Email: admin@pearlfoods.com");
    console.log("\n⚠️  IMPORTANT: Change the password after first login!\n");

    await mongoose.connection.close();
    console.log("✅ Done! Database connection closed.");
  } catch (error) {
    console.error("❌ Error creating SuperAdmin:", error.message);
    process.exit(1);
  }
}

// Run the script
createSuperAdmin();
