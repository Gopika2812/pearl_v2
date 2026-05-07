/**
 * Payroll Calculation Service
 * 
 * Input:
 *   employeeId
 *   month
 *   workingDays
 *   presentDays
 *   overtimeHours
 *   salaryStructure (object: { basicSalary, overtimeRate, bonus, deductions })
 * 
 * Output:
 *   basicSalary (pro-rated)
 *   overtimePay
 *   bonus
 *   deductions
 *   netSalary
 */

export const calculatePayroll = ({
  workingDays,
  presentDays,
  overtimeHours,
  lateHours = 0,
  extraLeaves = 0,
  salaryStructure,
}) => {
  const { basicSalary, overtimeRate, bonus, deductions, shiftStartTime = "09:00", shiftEndTime = "18:00" } = salaryStructure;

  // 1. Pro-rate basic salary based on attendance
  // Assuming full basic salary is for full working days
  const actualBasicSalary = workingDays > 0 
    ? (basicSalary / workingDays) * presentDays 
    : 0;

  // 2. Overtime Pay
  const overtimePay = overtimeHours * overtimeRate;
  
  // 3. Late Hours Deduction
  // Formula: (Daily Salary / Shift Working Hours) * Late Hours
  const dailySalary = basicSalary / 30; // Standard 30-day month for rate calculation
  
  // Calculate Shift Hours
  const [sh1, sm1] = shiftStartTime.split(":").map(Number);
  const [sh2, sm2] = shiftEndTime.split(":").map(Number);
  const shiftDuration = (sh2 + sm2/60) - (sh1 + sm1/60) || 9; // Fallback to 9h

  const hourlyRate = dailySalary / shiftDuration;
  const lateHoursDeduction = lateHours * hourlyRate;

  // 4. Extra Leave Deduction
  // Formula: Daily Salary * Extra Leaves
  const extraLeaveDeduction = extraLeaves * dailySalary;

  const grossSalary = actualBasicSalary + overtimePay + bonus;
  const netSalary = grossSalary - (deductions + lateHoursDeduction + extraLeaveDeduction);

  return {
    basicSalary: actualBasicSalary,
    overtimePay,
    bonus,
    deductions,
    lateHoursDeduction,
    extraLeaveDeduction,
    grossSalary,
    netSalary: netSalary > 0 ? netSalary : 0,
  };
};
