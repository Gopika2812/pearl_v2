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

    const attendanceRecords = await Attendance.find({
      employeeId: new mongoose.Types.ObjectId(employeeId),
      date: { $gte: start, $lte: end },
    });

    let presentDays = 0;
    let overtimeHours = 0;
    let totalLateHours = 0;
    let totalLeaves = 0;
    let totalAbsent = 0;

    attendanceRecords.forEach(record => {
      if (record.status === "Present") {
        presentDays++;
        overtimeHours += (record.overtimeHours || 0);
        
        // Calculate Late Hours if presentTime is after shiftStartTime
        if (record.presentTime) {
          const pt = new Date(record.presentTime);
          const [sh, sm] = (salaryStructure.shiftStartTime || "09:00").split(":").map(Number);
          const shiftStart = new Date(record.presentTime);
          shiftStart.setHours(sh, sm, 0, 0);
          
          if (pt > shiftStart) {
            const diff = (pt - shiftStart) / (1000 * 60 * 60); // Hours
            totalLateHours += diff;
          }
        }
      } else if (record.status === "Leave") {
        totalLeaves++;
      } else if (record.status === "Absent") {
        totalAbsent++;
      }
    });

    // Extra Leaves = (Leaves + Absent) exceeding allowed limit
    const totalOffDays = totalLeaves + totalAbsent;
    const extraLeaves = Math.max(0, totalOffDays - (salaryStructure.allowedMonthlyLeaves || 0));

    // 3. Calculate Payroll
    const calculation = calculatePayroll({
      workingDays,
      presentDays,
      overtimeHours,
      lateHours: totalLateHours,
      extraLeaves,
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

// Update Payroll Adjustments (Super Admin manually adds bonus/fine)
export const updatePayrollAdjustments = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const { manualBonus, manualFine } = req.body;

    const record = await PayrollRecord.findById(payrollId);
    if (!record) {
      return res.status(404).json({ success: false, message: "Payroll record not found" });
    }

    if (record.status === "Paid") {
      return res.status(400).json({ success: false, message: "Cannot adjust a paid payroll record" });
    }

    record.manualBonus = Number(manualBonus) || 0;
    record.manualFine = Number(manualFine) || 0;

    // Recalculate netSalary
    // netSalary = (grossSalary + manualBonus) - (deductions + lateHoursDeduction + extraLeaveDeduction + manualFine)
    // Note: deductions, lateHoursDeduction, and extraLeaveDeduction are all types of subtractions
    const totalEarnings = record.grossSalary + record.manualBonus;
    const totalDeductions = (record.deductions || 0) + (record.lateHoursDeduction || 0) + (record.extraLeaveDeduction || 0) + record.manualFine;
    
    record.netSalary = Math.max(0, totalEarnings - totalDeductions);

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

// Update Salary Structure with Audit Logging
export const updateSalaryStructure = async (req, res) => {
  try {
    const { 
      employeeId, basicSalary, overtimeRate, bonus, deductions, 
      branchId, shiftStartTime, shiftEndTime, allowedMonthlyLeaves 
    } = req.body;

    // 1. Find existing structure to compare
    let structure = await SalaryStructure.findOne({ employeeId });
    const changes = [];

    if (structure) {
      if (structure.basicSalary !== Number(basicSalary)) changes.push(`Basic: ${structure.basicSalary} → ${basicSalary}`);
      if (structure.overtimeRate !== Number(overtimeRate)) changes.push(`OT: ${structure.overtimeRate} → ${overtimeRate}`);
      if (structure.bonus !== Number(bonus)) changes.push(`Bonus: ${structure.bonus} → ${bonus}`);
      if (structure.deductions !== Number(deductions)) changes.push(`Deductions: ${structure.deductions} → ${deductions}`);
      if (structure.shiftStartTime !== shiftStartTime) changes.push(`Shift Start: ${structure.shiftStartTime} → ${shiftStartTime}`);
      if (structure.shiftEndTime !== shiftEndTime) changes.push(`Shift End: ${structure.shiftEndTime} → ${shiftEndTime}`);
      if (structure.allowedMonthlyLeaves !== Number(allowedMonthlyLeaves)) changes.push(`Leaves: ${structure.allowedMonthlyLeaves} → ${allowedMonthlyLeaves}`);
    } else {
      changes.push("Initial Configuration Created");
    }

    const updateData = { 
      employeeId, basicSalary, overtimeRate, bonus, deductions, 
      branch: branchId, shiftStartTime, shiftEndTime, allowedMonthlyLeaves 
    };

    if (changes.length > 0) {
      const historyEntry = {
        changedBy: req.user?.id,
        changedByName: req.user?.username || "Super Admin",
        details: changes.join(" | "),
        timestamp: new Date()
      };
      
      if (structure) {
        structure.changeHistory.push(historyEntry);
        Object.assign(structure, updateData);
        await structure.save();
      } else {
        structure = new SalaryStructure({
          ...updateData,
          changeHistory: [historyEntry]
        });
        await structure.save();
      }
    }

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

    // RBAC: Non-SuperAdmin users can only see their own records
    if (req.user.role !== "SUPER_ADMIN") {
      query.employeeId = req.user.id;
    }

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
// Get All Salary Structures for a branch
export const getAllSalaryStructures = async (req, res) => {
  try {
    const { branchId } = req.query;
    if (!branchId) return res.status(400).json({ success: false, message: "branchId is required" });

    const structures = await SalaryStructure.find({ branch: branchId }).populate("employeeId", "name role").lean();
    
    // Also fetch employee codes
    const employeeIds = structures.map(s => s.employeeId?._id).filter(id => id);
    const profiles = await HREmployeeProfile.find({ employeeId: { $in: employeeIds } });
    const profileMap = new Map(profiles.map(p => [p.employeeId.toString(), p.employeeCode]));

    const result = structures.map(s => ({
      ...s,
      employeeName: s.employeeId?.name || "Unknown",
      employeeRole: s.employeeId?.role || "Staff",
      employeeCode: profileMap.get(s.employeeId?._id?.toString()) || "---"
    }));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Revert Payroll Status (Super Admin only)
export const revertPayrollStatus = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const record = await PayrollRecord.findById(payrollId);
    if (!record) return res.status(404).json({ success: false, message: "Payroll record not found" });

    record.status = "Pending";
    record.paymentDate = null;
    
    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
