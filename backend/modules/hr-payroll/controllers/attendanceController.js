import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import Branch from "../../../models/Branch.js";
import BranchUser from "../../../models/BranchUser.js";
import SuperAdmin from "../../../models/SuperAdmin.js";
import { getAddressFromCoords } from "../utils/geocoder.js";

// Mark Attendance
export const markAttendance = async (req, res) => {
  console.log("📥 RECEIVED markAttendance request:", req.body);
  try {
    const { employeeId, date, status, location, comment, branchId } = req.body;
    
    if (!employeeId || !date || !branchId) {
      return res.status(400).json({ success: false, message: "Missing required fields: employeeId, date, or branchId" });
    }

    // Role-based security: Regular users can only mark for themselves
    const isSuperAdmin = ["SUPERADMIN", "SUPER_ADMIN"].includes(req.user.role?.toUpperCase());
    if (!isSuperAdmin && employeeId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden: You can only mark attendance for yourself" });
    }

    // Validate ObjectIds to prevent CastErrors
    if (!mongoose.Types.ObjectId.isValid(employeeId) || !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ success: false, message: "Invalid ID format for employee or branch" });
    }

    let markStr;
    try {
      markStr = new Date(date).toISOString().split("T")[0];
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid date format provided" });
    }

    const todayDate = new Date(markStr);
    todayDate.setUTCHours(0, 0, 0, 0);
    
    // Normalize current date for backdate comparison
    const currentDay = new Date();
    currentDay.setUTCHours(0, 0, 0, 0);
    const isBackdated = todayDate < currentDay;

    let attendance = await Attendance.findOne({ 
      employeeId: new mongoose.Types.ObjectId(employeeId), 
      date: todayDate 
    });

    // Reverse geocode the location to get a readable name
    let addressName = "";
    try {
      if (location?.lat && location?.lng) {
        addressName = await getAddressFromCoords(location.lat, location.lng);
      }
    } catch (e) {
      console.error("Geocoder failed:", e.message);
      addressName = "Location Captured";
    }

    const updateData = {
      employeeId: new mongoose.Types.ObjectId(employeeId),
      date: todayDate,
      status,
      branch: new mongoose.Types.ObjectId(branchId),
      isApproved: !isBackdated,
      markedBy: (req.user?.id || req.user?._id) ? new mongoose.Types.ObjectId(req.user.id || req.user._id) : undefined,
      markedByModel: ["SUPERADMIN", "SUPER_ADMIN"].includes(req.user?.role?.toUpperCase()) ? "SuperAdmin" : "BranchUser",
      markedByName: req.user?.username || "System", // Fallback to username from token
    };

    // If possible, get the actual name/fullName for better display
    try {
      if (req.user?.id) {
        if (updateData.markedByModel === "SuperAdmin") {
          const admin = await SuperAdmin.findById(req.user.id);
          if (admin) updateData.markedByName = admin.fullName;
        } else {
          const u = await BranchUser.findById(req.user.id);
          if (u) updateData.markedByName = u.name || u.username;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch marker name:", e.message);
    }

    // Sanitize location coordinates to avoid NaN errors
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    const safeLat = isNaN(lat) ? 0 : lat;
    const safeLng = isNaN(lng) ? 0 : lng;

    if (status === "Present") {
      updateData.presentTime = new Date();
      updateData.presentLocation = {
        lat: safeLat,
        lng: safeLng,
        address: addressName || "Location Captured"
      };
      // Clear leave data in case of re-marking or correction
      updateData.leaveTime = null;
      updateData.leaveLocation = null;
      updateData.workingHours = 0;
      updateData.overtimeHours = 0;
    } else if (status === "Leave" || status === "Absent") {
      if (attendance && (attendance.status === "Present" || attendance.presentTime)) {
        updateData.leaveTime = new Date();
        updateData.leaveLocation = {
          lat: safeLat,
          lng: safeLng,
          address: addressName || "Location Captured"
        };
        
        const startTime = attendance.presentTime ? new Date(attendance.presentTime) : null;
        if (startTime && !isNaN(startTime.getTime())) {
          const diffMs = updateData.leaveTime - startTime;
          const diffHrs = Math.max(0, diffMs / (1000 * 60 * 60));
          updateData.workingHours = isNaN(diffHrs) ? 0 : diffHrs;
          
          if (diffHrs > 9 && comment) {
            updateData.comment = comment;
            updateData.overtimeHours = Math.max(0, diffHrs - 9);
          }
        }
      } else {
        updateData.leaveTime = new Date();
        updateData.leaveLocation = {
          lat: safeLat,
          lng: safeLng,
          address: addressName || "Location Captured"
        };
      }
    }

    if (comment) updateData.comment = comment;

    console.log("💾 Attempting to save attendance to DB:", updateData);

    attendance = await Attendance.findOneAndUpdate(
      { employeeId: new mongoose.Types.ObjectId(employeeId), date: todayDate },
      { $set: updateData },
      { upsert: true, new: true, runValidators: false }
    );

    res.status(200).json({ 
      success: true, 
      data: attendance
    });
  } catch (error) {
    console.error("❌ CRITICAL Attendance Mark Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Daily Attendance for specific date and branch
export const getDailyAttendance = async (req, res) => {
  try {
    const { branchId, date } = req.query;
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);

    const isSuperAdmin = ["SUPERADMIN", "SUPER_ADMIN"].includes(req.user.role?.toUpperCase());
    let query = {
      branch: branchId,
      date: targetDate
    };

    // If not super admin, only fetch the logged-in user's records
    if (!isSuperAdmin) {
      query.employeeId = req.user.id;
    }

    const records = await Attendance.find(query).populate("markedBy", "name fullName");

    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Monthly Summary for all employees in a branch
export const getMonthlySummary = async (req, res) => {
  try {
    const { branchId, month } = req.query; // month format: "YYYY-MM"
    const start = new Date(`${month}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

    const isSuperAdmin = ["SUPERADMIN", "SUPER_ADMIN"].includes(req.user.role?.toUpperCase());
    const matchStage = {
      branch: new mongoose.Types.ObjectId(branchId),
      date: { $gte: start, $lte: end },
    };

    if (!isSuperAdmin) {
      matchStage.employeeId = new mongoose.Types.ObjectId(req.user.id);
    }

    const summary = await Attendance.aggregate([
      {
        $match: matchStage,
      },
      {
        $group: {
          _id: "$employeeId",
          presentDays: {
            $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
          },
          absentDays: {
            $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] },
          },
          leaveDays: {
            $sum: { $cond: [{ $eq: ["$status", "Leave"] }, 1, 0] },
          },
          totalOvertime: { $sum: "$overtimeHours" },
        },
      },
      {
        $lookup: {
          from: "branchusers",
          localField: "_id",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      {
        $lookup: {
          from: "hremployeeprofiles",
          localField: "_id",
          foreignField: "employeeId",
          as: "hrProfile",
        },
      },
      {
        $project: {
          employeeId: "$_id",
          name: "$employee.name",
          role: "$employee.role",
          employeeCode: { $arrayElemAt: ["$hrProfile.employeeCode", 0] },
          presentDays: 1,
          absentDays: 1,
          leaveDays: 1,
          totalOvertime: 1,
        },
      },
    ]);

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve Attendance
export const approveAttendance = async (req, res) => {
  try {
    const { employeeId, date } = req.body;
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);

    const isSuperAdmin = ["SUPERADMIN", "SUPER_ADMIN"].includes(req.user.role?.toUpperCase());
    if (!isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: Only Super Admins can approve attendance" });
    }

    const attendance = await Attendance.findOneAndUpdate(
      { employeeId, date: targetDate },
      { $set: { isApproved: true } },
      { new: true }
    );

    if (!attendance) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Revert/Delete Attendance
export const revertAttendance = async (req, res) => {
  try {
    const { employeeId, date } = req.body;
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);

    const isSuperAdmin = ["SUPERADMIN", "SUPER_ADMIN"].includes(req.user.role?.toUpperCase());
    if (!isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: Only Super Admins can revert attendance" });
    }

    const attendance = await Attendance.findOne({ employeeId, date: targetDate });
    
    if (!attendance) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    if (attendance.status === "Leave" || attendance.status === "Absent") {
      // If it was Finished (Leave/Absent), revert to "Present" if presentTime exists
      if (attendance.presentTime) {
        attendance.status = "Present";
        attendance.leaveTime = undefined;
        attendance.leaveLocation = undefined;
        attendance.workingHours = 0;
        attendance.overtimeHours = 0;
        await attendance.save();
        return res.status(200).json({ success: true, message: "Reverted to Present", data: attendance });
      }
    }

    // Otherwise, delete the whole record
    await Attendance.deleteOne({ _id: attendance._id });
    res.status(200).json({ success: true, message: "Attendance record deleted", data: null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Detailed Logs for Attendance Record Page
export const getDetailedLogs = async (req, res) => {
  console.log("-----------------------------------------");
  console.log("📥 [getDetailedLogs] Incoming Request");
  console.log("👤 Auth User:", JSON.stringify(req.user));
  console.log("📊 Raw Query:", JSON.stringify(req.query));

  try {
    let { branchId, date, startDate, endDate, employeeId, status } = req.query;

    // Clean parameters: Convert empty strings or "undefined" strings to null
    const clean = (val) => (val === "" || val === "undefined" || !val) ? null : val;
    branchId = clean(branchId);
    employeeId = clean(employeeId);
    status = clean(status);

    const userRole = req.user.role?.toUpperCase();
    const isGlobalAdmin = ["SUPERADMIN", "SUPER_ADMIN"].includes(userRole);
    const isBranchAdmin = userRole === "ADMIN";
    
    let query = {};
    
    // 🎯 SMART FILTERING: If a branch is selected, we want users WHO BELONG to that branch
    if (branchId && branchId !== "" && branchId !== "null") {
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        return res.status(400).json({ success: false, message: `Invalid branchId format: "${branchId}"` });
      }
      // Find all employees belonging to this branch
      const branchEmployees = await BranchUser.find({ branch: new mongoose.Types.ObjectId(branchId) }).select("_id");
      const employeeIds = branchEmployees.map(e => e._id);
      
      // Show logs if the attendance was marked for this branch OR the employee belongs to it
      query.$or = [
        { branch: new mongoose.Types.ObjectId(branchId) },
        { employeeId: { $in: employeeIds } }
      ];
    }

    if (!isGlobalAdmin && !isBranchAdmin) {
      query.employeeId = req.user.id;
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    if (date) {
      const targetDate = new Date(date);
      targetDate.setUTCHours(0, 0, 0, 0);
      query.date = targetDate;
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    if (status) {
      query.status = status;
    }

    const logs = await Attendance.find(query)
      .populate({
        path: "employeeId",
        select: "name role branch branchName",
        populate: { path: "branch", select: "name" }
      })
      .populate("branch", "name")
      .populate("markedBy", "name fullName")
      .sort({ date: -1, createdAt: -1 });

    console.log(`📊 Found ${logs.length} logs. Sample branch: "${logs[0]?.branch?.name || logs[0]?.employeeId?.branch?.name || logs[0]?.employeeId?.branchName}"`);

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error("❌ [getDetailedLogs] ERROR:", error.message, "\n", error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
};
