/**
 * Quick Setup Script for Branches and Users
 * Run with: node backend/utils/setupBranches.js
 */

import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const API_URL = process.env.API_URL || "http://localhost:5000";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function log(message, color = "reset") {
  console.log(colors[color] + message + colors.reset);
}

async function createBranch(branchData) {
  try {
    const response = await fetch(`${API_URL}/api/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branchData),
    });

    const data = await response.json();

    if (data.success) {
      log(`✓ Branch created: ${data.data._id}`, "green");
      return data.data._id;
    } else {
      log(`✗ Failed to create branch: ${data.message}`, "red");
      return null;
    }
  } catch (error) {
    log(`✗ Error creating branch: ${error.message}`, "red");
    return null;
  }
}

async function createUser(userData) {
  try {
    const response = await fetch(`${API_URL}/api/branch-users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (data.success) {
      log(`  ✓ User created: ${data.data.username}`, "green");
      return true;
    } else {
      log(`  ✗ Failed to create user: ${data.message}`, "red");
      return false;
    }
  } catch (error) {
    log(`  ✗ Error creating user: ${error.message}`, "red");
    return false;
  }
}

async function setupBranches() {
  log("\n🚀 Pearl ERP - Branch & User Setup\n", "yellow");

  // Branch 1: Main Branch
  log("=== Creating Main Branch ===", "yellow");
  const branchId1 = await createBranch({
    name: "Pearl Foods & Frozen - Tirunelveli",
    code: "PF-TRV",
    location: "Tirunelveli",
    address: "Main Head Office, Tirunelveli, Tamil Nadu 627001",
    phone: "9429692970",
    email: "tirunelveli@pearlfood.com",
    manager: "Ramesh Kumar",
    isMainBranch: true,
    status: "ACTIVE",
  });

  if (branchId1) {
    log("Creating users for Main Branch:", "yellow");
    await createUser({
      username: "tirunelveli_admin",
      password: "secure@123",
      email: "admin@tirunelveli.com",
      branchId: branchId1,
      role: "ADMIN",
    });

    await createUser({
      username: "tirunelveli_manager",
      password: "secure@123",
      email: "manager@tirunelveli.com",
      branchId: branchId1,
      role: "MANAGER",
    });

    await createUser({
      username: "tirunelveli_staff",
      password: "secure@123",
      email: "staff@tirunelveli.com",
      branchId: branchId1,
      role: "STAFF",
    });
  }

  // Branch 2: Secondary Branch
  log("\n=== Creating Secondary Branch ===", "yellow");
  const branchId2 = await createBranch({
    name: "Pearl Foods & Frozen - Nagercoil",
    code: "PF-NGC",
    location: "Nagercoil",
    address: "Branch Office, Nagercoil, Tamil Nadu 629001",
    phone: "9429692971",
    email: "nagercoil@pearlfood.com",
    manager: "Suresh Kumar",
    isMainBranch: false,
    status: "ACTIVE",
  });

  if (branchId2) {
    log("Creating users for Secondary Branch:", "yellow");
    await createUser({
      username: "nagercoil_admin",
      password: "secure@123",
      email: "admin@nagercoil.com",
      branchId: branchId2,
      role: "ADMIN",
    });

    await createUser({
      username: "nagercoil_manager",
      password: "secure@123",
      email: "manager@nagercoil.com",
      branchId: branchId2,
      role: "MANAGER",
    });

    await createUser({
      username: "nagercoil_staff",
      password: "secure@123",
      email: "staff@nagercoil.com",
      branchId: branchId2,
      role: "STAFF",
    });
  }

  // Summary
  log("\n=== Setup Summary ===", "yellow");
  log("\n📍 Branches Created:", "green");
  log("  1. Pearl Foods & Frozen - Tirunelveli (PF-TRV)");
  log("  2. Pearl Foods & Frozen - Nagercoil (PF-NGC)");

  log("\n👤 Login Credentials:", "green");
  log("\n  Branch 1 (Tirunelveli):");
  log("    Admin:   tirunelveli_admin / secure@123");
  log("    Manager: tirunelveli_manager / secure@123");
  log("    Staff:   tirunelveli_staff / secure@123");

  log("\n  Branch 2 (Nagercoil):");
  log("    Admin:   nagercoil_admin / secure@123");
  log("    Manager: nagercoil_manager / secure@123");
  log("    Staff:   nagercoil_staff / secure@123");

  log("\n🌐 Access the app:", "green");
  log("  URL: http://localhost:5173/branch-login");
  log("  Select branch → Enter credentials → Login\n", "green");
}

// Run setup
setupBranches().catch((error) => {
  log(`Fatal error: ${error.message}`, "red");
  process.exit(1);
});
