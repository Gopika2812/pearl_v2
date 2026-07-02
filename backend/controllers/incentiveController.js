import BranchUser from "../models/BranchUser.js";
import Attendance from "../modules/hr-payroll/models/Attendance.js";
import Invoice from "../models/Invoice.js";
import FollowUp from "../models/FollowUp.js";
import mongoose from "mongoose";

export const getIncentiveReport = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { fromDate, toDate } = req.query;

    if (!branchId || !fromDate || !toDate) {
      return res.status(400).json({ success: false, message: "Branch ID, fromDate, and toDate are required." });
    }

    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // Get all active users in the branch
    const users = await BranchUser.find({
      $or: [{ branch: branchId }, { allowedBranches: branchId }],
      status: "ACTIVE"
    });

    const reportData = [];

    // Parallel fetch for each user could be done via aggregation or iteration.
    // Iteration with Promise.all is easier to read and maintain for this specific structure.
    await Promise.all(
      users.map(async (user) => {
        const userName = user.name || user.username;
        
        // 1. Attendance
        const attendances = await Attendance.find({
          employeeId: user._id,
          date: { $gte: start, $lte: end }
        });

        let totalWorkingHours = 0;
        let isLeaveOnly = true;
        let hasAnyAttendance = false;

        attendances.forEach(att => {
          hasAnyAttendance = true;
          if (att.status !== "Leave" && att.status !== "Absent") {
            isLeaveOnly = false;
            totalWorkingHours += (att.workingHours || 0);
          }
        });

        let attendanceStr = "0 hrs";
        if (hasAnyAttendance) {
          if (isLeaveOnly) {
             attendanceStr = "Leave (0 hrs)";
          } else {
             attendanceStr = `${totalWorkingHours.toFixed(1)} hrs`;
          }
        } else {
           attendanceStr = "-"; // No record
        }

        // 2. Billing count (Invoice where billingPerson matches)
        const billCount = await Invoice.countDocuments({
          branchId,
          invoiceDate: { $gte: start, $lte: end },
          billingPerson: { $regex: new RegExp(`^${userName}$`, "i") }
        });

        // 3. Delivery count & Sales value (Invoice where deliveryPerson matches)
        const deliveryInvoices = await Invoice.find({
          branchId,
          invoiceDate: { $gte: start, $lte: end },
          deliveryPerson: { $regex: new RegExp(`^${userName}$`, "i") }
        }, "grandTotal");

        const deliveryCount = deliveryInvoices.length;
        const salesValue = deliveryInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

        // 4. Followup count (Finance)
        const financeFollowupCount = await FollowUp.countDocuments({
          branchId,
          createdAt: { $gte: start, $lte: end },
          followUpType: "FINANCE",
          followUpBy: { $regex: new RegExp(`^${userName}$`, "i") }
        });

        // 5. Order Followup count
        const orderFollowupCount = await FollowUp.countDocuments({
          branchId,
          createdAt: { $gte: start, $lte: end },
          followUpType: "ORDER",
          followUpBy: { $regex: new RegExp(`^${userName}$`, "i") }
        });

        reportData.push({
          userId: user._id,
          userName: userName,
          attendanceStr: attendanceStr,
          billCount: billCount,
          deliveryCount: deliveryCount,
          salesValue: salesValue,
          financeFollowupCount: financeFollowupCount,
          orderFollowupCount: orderFollowupCount
        });
      })
    );

    return res.status(200).json({ success: true, data: reportData });
  } catch (error) {
    console.error("Error in getIncentiveReport:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
