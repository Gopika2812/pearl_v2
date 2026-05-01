import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";

// Mark Attendance
export const markAttendance = async (req, res) => {
  try {
    const { employeeId, date, status, location, comment, branchId } = req.body;
    const today = new Date(date).setHours(0, 0, 0, 0);

    const todayDate = new Date(today);

    let attendance = await Attendance.findOne({ employeeId, date: todayDate });

    const updateData = {
      employeeId,
      date: todayDate,
      status,
      branch: branchId,
    };

    if (status === "Present") {
      updateData.presentTime = new Date();
      updateData.presentLocation = {
        lat: Number(location?.lat),
        lng: Number(location?.lng)
      };
    } else if (status === "Leave" || status === "Absent") {
      // If marking Leave/Absent after Present, calculate hours
      if (attendance && attendance.status === "Present" && attendance.presentTime) {
        updateData.leaveTime = new Date();
        updateData.leaveLocation = {
          lat: Number(location?.lat),
          lng: Number(location?.lng)
        };
        
        const diffMs = updateData.leaveTime - new Date(attendance.presentTime);
        const diffHrs = diffMs / (1000 * 60 * 60);
        updateData.workingHours = diffHrs;
        
        if (diffHrs > 9 && comment) {
          updateData.comment = comment;
          updateData.overtimeHours = diffHrs - 9;
        }
      } else {
        updateData.leaveTime = new Date();
        updateData.leaveLocation = {
          lat: Number(location?.lat),
          lng: Number(location?.lng)
        };
      }
    }

    if (comment) updateData.comment = comment;

    attendance = await Attendance.findOneAndUpdate(
      { employeeId, date: todayDate },
      { $set: updateData },
      { upsert: true, new: true, runValidators: false }
    );

    res.status(200).json({ 
      success: true, 
      data: attendance,
      debug: { receivedLocation: location, body: req.body } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Daily Attendance for specific date and branch
export const getDailyAttendance = async (req, res) => {
  try {
    const { branchId, date } = req.query;
    const targetDate = new Date(date).setHours(0, 0, 0, 0);

    const records = await Attendance.find({
      branch: branchId,
      date: targetDate
    });

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

    const summary = await Attendance.aggregate([
      {
        $match: {
          branch: new mongoose.Types.ObjectId(branchId),
          date: { $gte: start, $lte: end },
        },
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
        $project: {
          employeeId: "$_id",
          name: "$employee.name",
          role: "$employee.role",
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
