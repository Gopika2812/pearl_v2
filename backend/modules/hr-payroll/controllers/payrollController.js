import mongoose from "mongoose";
import PayrollRecord from "../models/PayrollRecord.js";
import SalaryStructure from "../models/SalaryStructure.js";
import Attendance from "../models/Attendance.js";
import HREmployeeProfile from "../models/HREmployeeProfile.js";
import { calculatePayroll } from "../services/payrollEngine.js";
import { createSalaryExpense } from "../services/zohoBooksService.js";

// Generate/Update Payroll for an employee
export const generatePayroll = async (req, res) => {
  try {
    const { employeeId, month, workingDays, branchId } = req.body;

    // 1. Fetch Salary Structure
    const salaryStructure = await SalaryStructure.findOne({ employeeId });
    if (!salaryStructure) {
      return res.status(404).json({ success: false, message: "Salary structure not found for this employee" });
    }

    // 2. Fetch Attendance Summary for the month
    const start = new Date(`${month}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

    const attendanceData = await Attendance.aggregate([
      {
        $match: {
          employeeId: new mongoose.Types.ObjectId(employeeId),
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$employeeId",
          presentDays: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } },
          totalOvertime: { $sum: "$overtimeHours" },
        },
      },
    ]);

    const presentDays = attendanceData.length > 0 ? attendanceData[0].presentDays : 0;
    const overtimeHours = attendanceData.length > 0 ? attendanceData[0].totalOvertime : 0;

    // 3. Calculate Payroll
    const calculation = calculatePayroll({
      workingDays,
      presentDays,
      overtimeHours,
      salaryStructure,
    });

    // 4. Save/Update Payroll Record
    const payrollRecord = await PayrollRecord.findOneAndUpdate(
      { employeeId, month },
      {
        ...calculation,
        employeeId,
        month,
        branch: branchId,
        status: "Pending", // Default status
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, data: payrollRecord });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Payroll Status (and trigger Zoho integration)
export const updatePayrollStatus = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const { status } = req.body;

    const record = await PayrollRecord.findById(payrollId).populate("employeeId");
    if (!record) {
      return res.status(404).json({ success: false, message: "Payroll record not found" });
    }

    record.status = status;
    if (status === "Paid") {
      record.paymentDate = new Date();
      
      // Trigger Zoho Books Integration
      try {
        const zohoResult = await createSalaryExpense({
          employeeName: record.employeeId.name,
          amount: record.netSalary,
          month: record.month,
          employeeId: record.employeeId._id,
        });
        record.zohoExpenseId = zohoResult.expense.expense_id;
      } catch (zohoError) {
        console.error("Zoho Integration Failed:", zohoError.message);
        // We might still want to save the "Paid" status even if Zoho fails, 
        // but maybe flag it? For now, we'll just log it.
      }
    }

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Salary Structure for an employee
export const getSalaryStructure = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const structure = await SalaryStructure.findOne({ employeeId });
    res.status(200).json({ success: true, data: structure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Salary Structure
export const updateSalaryStructure = async (req, res) => {
  try {
    const { employeeId, basicSalary, overtimeRate, bonus, deductions, branchId } = req.body;
    const structure = await SalaryStructure.findOneAndUpdate(
      { employeeId },
      { employeeId, basicSalary, overtimeRate, bonus, deductions, branch: branchId },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, data: structure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Payroll History
export const getPayrollHistory = async (req, res) => {
  try {
    const { branchId, month } = req.query;
    const query = { branch: branchId };
    if (month) query.month = month;

    const records = await PayrollRecord.find(query).populate("employeeId", "name role").lean();
    
    // Fetch employee codes for these records
    const employeeIds = records.map(r => r.employeeId?._id).filter(id => id);
    const profiles = await HREmployeeProfile.find({ employeeId: { $in: employeeIds } });
    const profileMap = new Map(profiles.map(p => [p.employeeId.toString(), p.employeeCode]));

    const recordsWithCodes = records.map(r => ({
      ...r,
      employeeCode: profileMap.get(r.employeeId?._id?.toString()) || "---"
    }));

    res.status(200).json({ success: true, data: recordsWithCodes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
