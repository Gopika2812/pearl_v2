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
  salaryStructure,
}) => {
  const { basicSalary, overtimeRate, bonus, deductions } = salaryStructure;

  // Pro-rate basic salary based on attendance
  // Assuming full basic salary is for full working days
  const actualBasicSalary = workingDays > 0 
    ? (basicSalary / workingDays) * presentDays 
    : 0;

  const overtimePay = overtimeHours * overtimeRate;
  
  const grossSalary = actualBasicSalary + overtimePay + bonus;
  const netSalary = grossSalary - deductions;

  return {
    basicSalary: actualBasicSalary,
    overtimePay,
    bonus,
    deductions,
    grossSalary,
    netSalary: netSalary > 0 ? netSalary : 0,
  };
};
