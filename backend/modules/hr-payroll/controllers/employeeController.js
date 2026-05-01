import mongoose from "mongoose";
import BranchUser from "../../../models/BranchUser.js";
import HREmployeeProfile from "../models/HREmployeeProfile.js";

// Get employees for a branch with their HR profiles (consecutive IDs)
export const getHREmployees = async (req, res) => {
  try {
    const { branchId } = req.query;

    if (!branchId || branchId === "undefined") {
      return res.status(400).json({ success: false, message: "Valid Branch ID is required" });
    }

    // 1. Fetch all active users for this branch from main system
    const users = await BranchUser.find({ 
      branch: branchId, 
      status: "ACTIVE" 
    }).lean();

    // 2. Fetch HR profiles for these users
    const profiles = await HREmployeeProfile.find({ branch: branchId });
    const profileMap = new Map(profiles.map(p => [p.employeeId.toString(), p]));

    // 3. Process users: ensure every user has a profile/code
    const processedEmployees = [];
    let nextCode = null;

    for (const user of users) {
      let profile = profileMap.get(user._id.toString());

      if (!profile) {
        // Generate next code if missing
        if (nextCode === null) {
          const lastProfile = await HREmployeeProfile.findOne({ branch: branchId })
            .sort({ employeeCode: -1 });
          nextCode = lastProfile ? parseInt(lastProfile.employeeCode) + 1 : 1;
        }

        const codeStr = nextCode.toString().padStart(3, '0');
        profile = await HREmployeeProfile.create({
          employeeId: user._id,
          branch: branchId,
          employeeCode: codeStr
        });
        nextCode++;
      }

      processedEmployees.push({
        ...user,
        hrProfile: profile,
        employeeCode: profile.employeeCode
      });
    }

    // Sort by employee code
    processedEmployees.sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));

    res.status(200).json({ success: true, data: processedEmployees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
