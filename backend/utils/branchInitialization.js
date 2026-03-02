/**
 * BRANCH INITIALIZATION SCRIPT
 * Run this once to set up initial branches in the database
 * Then comment it out to prevent duplicate inserts
 */

import Branch from "../models/Branch.js";

export async function initializeBranches() {
  try {
    const existingBranches = await Branch.countDocuments();

    if (existingBranches === 0) {
      const branches = [
        {
          name: "Pearl Foods & Frozen - Tirunelveli",
          code: "PF-TRV",
          location: "Tirunelveli",
          address: "Main Office, Tirunelveli",
          phone: "9429692970",
          email: "tirunelveli@pearlfood.com",
          manager: "Branch Manager",
          isMainBranch: true,
          color: "#1e7a96",
          status: "ACTIVE",
        },
        // Add more branches here as needed later
        // {
        //   name: "Pearl Foods & Frozen - Nagercoil",
        //   code: "PF-NGC",
        //   location: "Nagercoil",
        //   address: "Branch Office, Nagercoil",
        //   phone: "9429692971",
        //   email: "nagercoil@pearlfood.com",
        //   manager: "Manager Name",
        //   isMainBranch: false,
        //   color: "#2a5a7f",
        //   status: "ACTIVE",
        // },
      ];

      const result = await Branch.insertMany(branches);
      console.log(`✅ Initialized ${result.length} branches`);
      return result;
    } else {
      console.log(`✅ Branches already initialized (${existingBranches} found)`);
    }
  } catch (error) {
    console.error("❌ Error initializing branches:", error);
  }
}
