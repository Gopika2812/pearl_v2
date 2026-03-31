import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI;

async function createSuperAdminDirect() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const superAdminCollection = db.collection("superadmins");

    // Check if super admin already exists
    const existing = await superAdminCollection.findOne({ username: "superadmin" });

    if (existing) {
      console.log("⚠️  SuperAdmin 'superadmin' already exists!");
      console.log("\nExisting SuperAdmin Details:");
      console.log(`- Username: ${existing.username}`);
      console.log(`- Email: ${existing.email}`);
      console.log(`- Full Name: ${existing.fullName}`);
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const password = "SuperAdmin@123";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create super admin document
    const superAdminDoc = {
      username: "superadmin",
      password: hashedPassword,
      email: "admin@pearlfoods.com",
      fullName: "System Administrator",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert into database
    const result = await superAdminCollection.insertOne(superAdminDoc);

    console.log("\n✅ SuperAdmin User Created Successfully!\n");
    console.log("🔐 Login Credentials:");
    console.log("- URL: http://localhost:5173/super-admin-login");
    console.log("- Username: superadmin");
    console.log("- Password: SuperAdmin@123");
    console.log("- Email: admin@pearlfoods.com");
    console.log(`- MongoDB ID: ${result.insertedId}`);
    console.log("\n⚠️  IMPORTANT: Change the password after first login!\n");

    await mongoose.disconnect();
    console.log("✅ Done! Database connection closed.");
  } catch (error) {
    console.error("❌ Error creating SuperAdmin:", error.message);
    process.exit(1);
  }
}

createSuperAdminDirect();
