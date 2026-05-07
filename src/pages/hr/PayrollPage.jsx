import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { FaMoneyCheck, FaPlay, FaCheckCircle, FaExclamationCircle, FaUser, FaPrint, FaDownload } from "react-icons/fa";
import { fetchWithAuth, API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";

const PayrollPage = () => {
  const { currentBranch, user } = useBranch();
  const [employees, setEmployees] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [adjustments, setAdjustments] = useState({}); // { payrollId: { bonus, fine } }

  useEffect(() => {
    if (currentBranch?._id) {
      if (isSuperAdmin) {
        fetchEmployees();
      }
      fetchHistory();
    }
  }, [currentBranch, month, user]);

  const fetchEmployees = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/employees/list?branchId=${currentBranch?._id}`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/history?branchId=${currentBranch?._id}&month=${month}`);
      const data = await res.json();
      if (data.success) {
        setPayrollHistory(data.data);
      }
    } catch (err) {}
  };

  const handleProcess = async (employeeId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/generate`, {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          month,
          workingDays: 30,
          branchId: currentBranch?._id
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Payroll calculated successfully");
        fetchHistory();
      } else {
        toast.error(data.message || "Failed to process payroll");
      }
    } catch (err) {
      toast.error("Error processing payroll");
    }
  };

  const handleMarkPaid = async (payrollId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/status/${payrollId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Paid" })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Payroll marked as Paid. Zoho Expense created.");
        fetchHistory();
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleRevert = async (payrollId) => {
    if (!window.confirm("Are you sure you want to revert this payment record to Pending status?")) return;
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/revert/${payrollId}`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Payroll record reverted to Pending");
        fetchHistory();
      }
    } catch (err) {
      toast.error("Failed to revert payroll");
    }
  };

  const handleUpdateAdjustments = async (payrollId) => {
    const adj = adjustments[payrollId];
    if (!adj) {
        toast.info("No changes to save");
        return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}/hr/payroll/adjustments/${payrollId}`, {
        method: "PATCH",
        body: JSON.stringify({
          manualBonus: parseFloat(adj.bonus) || 0,
          manualFine: parseFloat(adj.fine) || 0
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Adjustments saved");
        fetchHistory();
      }
    } catch (err) {
      toast.error("Failed to save adjustments");
    }
  };

  const handlePrint = (record) => {
    const printWindow = window.open('', '_blank');
    const content = `
      <html>
        <head>
          <title>Payslip - ${record.employeeId?.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
            .logo-container { display: flex; align-items: center; gap: 15px; }
            .logo { width: 60px; height: 60px; object-fit: contain; }
            .company-name { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
            .payslip-title { text-align: right; }
            .payslip-title h1 { margin: 0; font-size: 28px; font-weight: 900; color: #4f46e5; text-transform: uppercase; }
            .payslip-title p { margin: 0; font-size: 14px; color: #64748b; font-weight: 700; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .info-section h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; margin-bottom: 10px; }
            .info-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            .info-item span:first-child { color: #64748b; font-weight: 500; }
            .info-item span:last-child { font-weight: 700; }

            .salary-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .salary-table th { background: #f8fafc; padding: 15px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
            .salary-table td { padding: 15px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
            
            .earnings { color: #059669; }
            .deductions { color: #dc2626; }
            
            .total-box { background: #4f46e5; color: white; padding: 30px; rounded: 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 20px; }
            .total-label { font-size: 14px; font-weight: 700; text-transform: uppercase; }
            .total-value { font-size: 32px; font-weight: 900; }

            .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-container">
              <img src="/logo.jpeg" class="logo" alt="Pearls Logo" />
              <div class="company-name">Pearls ERP</div>
            </div>
            <div class="payslip-title">
              <h1>Payslip</h1>
              <p>For the month of ${record.month}</p>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-section">
              <h2>Employee Details</h2>
              <div class="info-item"><span>Name</span><span>${record.employeeId?.name}</span></div>
              <div class="info-item"><span>Employee ID</span><span>${record.employeeCode || '---'}</span></div>
              <div class="info-item"><span>Role</span><span>${record.employeeId?.role}</span></div>
              <div class="info-item"><span>Branch</span><span>${currentBranch?.name}</span></div>
            </div>
            <div class="info-section">
              <h2>Payment Details</h2>
              <div class="info-item"><span>Status</span><span style="color: ${record.status === 'Paid' ? '#059669' : '#d97706'}">${record.status}</span></div>
              <div class="info-item"><span>Payment Date</span><span>${record.paymentDate ? new Date(record.paymentDate).toLocaleDateString() : 'Pending'}</span></div>
              <div class="info-item"><span>Reference ID</span><span>${record._id}</span></div>
              ${record.zohoExpenseId ? `<div class="info-item"><span>Zoho Ref</span><span>#${record.zohoExpenseId}</span></div>` : ''}
            </div>
          </div>

          <table class="salary-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Basic Salary</td>
                <td style="text-align: right" class="earnings">${record.basicSalary.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Overtime Pay</td>
                <td style="text-align: right" class="earnings">${record.overtimePay.toLocaleString()}</td>
              </tr>
              ${record.manualBonus > 0 ? `<tr><td>Additional Bonus (Adj)</td><td style="text-align: right" class="earnings">${record.manualBonus.toLocaleString()}</td></tr>` : ''}
              
              <tr>
                <td>Standard Deductions</td>
                <td style="text-align: right" class="deductions">-${record.deductions.toLocaleString()}</td>
              </tr>
              ${record.lateHoursDeduction > 0 ? `<tr><td>Late Coming Fine</td><td style="text-align: right" class="deductions">-${record.lateHoursDeduction.toLocaleString()}</td></tr>` : ''}
              ${record.extraLeaveDeduction > 0 ? `<tr><td>Unpaid Leaves Deduction</td><td style="text-align: right" class="deductions">-${record.extraLeaveDeduction.toLocaleString()}</td></tr>` : ''}
              ${record.manualFine > 0 ? `<tr><td>Additional Fine (Adj)</td><td style="text-align: right" class="deductions">-${record.manualFine.toLocaleString()}</td></tr>` : ''}
            </tbody>
          </table>

          <div class="total-box">
            <div class="total-label">Net Payout (Grand Pay)</div>
            <div class="total-value">₹${record.netSalary.toLocaleString()}</div>
          </div>

          <div class="footer">
            <p>This is a computer-generated payslip and does not require a physical signature.</p>
            <p>&copy; ${new Date().getFullYear()} Pearls ERP Systems. All rights reserved.</p>
          </div>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Payroll Processing</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Calculate and payout monthly salaries</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <input 
            type="month" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 uppercase"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Employee List - Only for Super Admin */}
        {isSuperAdmin && (
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <span className="w-6 h-[2px] bg-indigo-500"></span> Active Employees
            </h2>
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-2 overflow-hidden shadow-sm">
              <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
                {employees.map(emp => {
                  const processed = payrollHistory.find(p => p.employeeId._id === emp._id);
                  const isPaid = processed?.status === "Paid";
                  return (
                    <div key={emp._id} className="group flex items-center justify-between p-4 hover:bg-slate-50 rounded-3xl transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 text-sm">
                          <FaUser />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black text-slate-800 uppercase leading-tight">{emp.name}</p>
                            <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-1 rounded uppercase">#{emp.employeeCode}</span>
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{emp.role}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleProcess(emp._id)}
                        disabled={isPaid}
                        className={`p-3 rounded-xl transition-all ${
                          isPaid ? "bg-emerald-50 text-emerald-500" : "bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white"
                        }`}
                        title={isPaid ? "Payment Completed" : (processed ? "Recalculate Payroll" : "Process Payroll")}
                      >
                        {isPaid ? <FaCheckCircle /> : <FaPlay />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Payroll History - Visible to everyone (Filtered by backend for non-admins) */}
        <div className={`${isSuperAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-6 h-[2px] bg-emerald-500"></span> {isSuperAdmin ? `Payroll Records - ${month}` : 'Your Payslips'}
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {payrollHistory.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <FaMoneyCheck className="text-2xl" />
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No payroll records found</p>
              </div>
            ) : (
              payrollHistory.map(record => (
                <div key={record._id} className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 flex flex-col gap-4 shadow-sm hover:border-indigo-100 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${record.status === "Paid" ? "bg-emerald-50 text-emerald-500" : "bg-amber-50 text-amber-500"}`}>
                        {record.status === "Paid" ? <FaCheckCircle className="text-xl" /> : <FaExclamationCircle className="text-xl" />}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 uppercase text-sm truncate">{record.employeeId?.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg uppercase whitespace-nowrap shadow-sm border border-indigo-100">Grand Pay: ₹{record.netSalary.toLocaleString()}</span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${record.status === "Paid" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                            {record.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Print Button for everyone */}
                      <button 
                        onClick={() => handlePrint(record)}
                        className="bg-slate-100 text-slate-600 p-2.5 rounded-xl hover:bg-slate-200 transition flex items-center gap-2 text-[10px] font-black uppercase"
                        title="Print Payslip"
                      >
                        <FaPrint /> <span className="hidden sm:inline">Payslip</span>
                      </button>

                      {isSuperAdmin && record.status === "Pending" && (
                        <button 
                          onClick={() => handleMarkPaid(record._id)}
                          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                        >
                          Pay Now
                        </button>
                      )}
                      {record.status === "Paid" && isSuperAdmin && (
                        <button 
                          onClick={() => handleRevert(record._id)}
                          className="bg-rose-50 text-rose-500 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition border border-rose-100"
                        >
                          Revert
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 border-t border-slate-50 pt-4">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Basic</p>
                      <p className="text-[11px] font-bold text-slate-700">₹{record.basicSalary.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">OT Pay</p>
                      <p className="text-[11px] font-bold text-slate-700">₹{record.overtimePay.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-rose-300 uppercase tracking-widest mb-1">Deductions</p>
                      <p className="text-[11px] font-bold text-rose-500">₹{(record.deductions + record.lateHoursDeduction + record.extraLeaveDeduction).toLocaleString()}</p>
                    </div>

                    {isSuperAdmin && record.status === "Pending" && (
                      <div className="flex items-center gap-3 border-l border-slate-100 pl-6">
                        <div className="flex flex-col gap-2">
                          <div className="space-y-0.5">
                            <label className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter">Add Bonus</label>
                            <input 
                              type="number"
                              className="w-24 px-2 py-1 text-[10px] font-bold bg-slate-50 border border-slate-100 rounded-md outline-none focus:border-indigo-300"
                              value={adjustments[record._id]?.bonus ?? record.manualBonus ?? ""}
                              onChange={(e) => setAdjustments({...adjustments, [record._id]: { ...adjustments[record._id], bonus: e.target.value }})}
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[7px] font-black text-rose-400 uppercase tracking-tighter">Add Fine</label>
                            <input 
                              type="number"
                              className="w-24 px-2 py-1 text-[10px] font-bold bg-slate-50 border border-slate-100 rounded-md outline-none focus:border-rose-300 text-rose-500"
                              value={adjustments[record._id]?.fine ?? record.manualFine ?? ""}
                              onChange={(e) => setAdjustments({...adjustments, [record._id]: { ...adjustments[record._id], fine: e.target.value }})}
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => handleUpdateAdjustments(record._id)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[9px] font-black uppercase tracking-widest shadow-md shadow-indigo-100"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollPage;
