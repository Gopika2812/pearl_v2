import { useEffect, useState } from "react";
import { FaSearch, FaSort, FaEye, FaCalendarAlt, FaUser, FaPhoneAlt, FaFileInvoiceDollar, FaMoneyBillWave, FaMobileAlt } from "react-icons/fa";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";
import { toast } from "react-toastify";

const BranchSpottedCustomerLedger = () => {
  const { currentBranch } = useBranch();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "dateTime", direction: "desc" });

  useEffect(() => {
    if (currentBranch?._id) {
      fetchRecords();
    }
  }, [currentBranch, sortConfig]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(
        `${API_BASE}/spotted-customer-ledger/${currentBranch._id}?search=${searchTerm}&sortField=${sortConfig.key}&sortOrder=${sortConfig.direction}`
      );
      const data = await res.json();
      if (data.success) {
        setRecords(data.data);
      }
    } catch (error) {
      toast.error("Failed to fetch ledger records");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredRecords = records.filter(record => 
    record.salesInvoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.collectedByUsername?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-20 md:pt-4 md:pl-20 px-4 pb-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-3">
              <span className="bg-[#319bab] text-white p-2 rounded-xl shadow-lg shadow-[#319bab]/20">
                <FaFileInvoiceDollar size={24} />
              </span>
              Spotted Customers Ledger
            </h1>
            <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mt-1 ml-14">Track payments for temporary spotted customers</p>
          </div>

          <div className="relative">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Invoice, Name or Phone..."
              className="pl-12 pr-6 py-4 bg-white border-2 border-gray-100 rounded-2xl w-full md:w-96 shadow-sm focus:ring-4 focus:ring-[#319bab]/10 focus:border-[#319bab] outline-none transition-all font-semibold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#319bab] transition-colors" onClick={() => handleSort("salesInvoiceNumber")}>
                    <div className="flex items-center gap-2">
                      <FaFileInvoiceDollar /> SI Number {sortConfig.key === "salesInvoiceNumber" && <FaSort className="text-[#319bab]" />}
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#319bab] transition-colors" onClick={() => handleSort("name")}>
                    <div className="flex items-center gap-2">
                      <FaUser /> Customer Name {sortConfig.key === "name" && <FaSort className="text-[#319bab]" />}
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <div className="flex items-center gap-2">
                      <FaPhoneAlt /> Phone
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#319bab] transition-colors" onClick={() => handleSort("grandTotal")}>
                    <div className="flex items-center gap-2">
                      Total Bill {sortConfig.key === "grandTotal" && <FaSort className="text-[#319bab]" />}
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <div className="flex items-center gap-2">
                      <FaMoneyBillWave /> Cash
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <div className="flex items-center gap-2">
                      <FaMobileAlt /> GPay / UPI
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#319bab] transition-colors" onClick={() => handleSort("dateTime")}>
                    <div className="flex items-center gap-2">
                      <FaCalendarAlt /> Date & Time {sortConfig.key === "dateTime" && <FaSort className="text-[#319bab]" />}
                    </div>
                  </th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 cursor-pointer hover:text-[#319bab] transition-colors" onClick={() => handleSort("collectedByUsername")}>
                    <div className="flex items-center gap-2">
                      <FaUser className="text-gray-300" /> Collected By {sortConfig.key === "collectedByUsername" && <FaSort className="text-[#319bab]" />}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-[#319bab] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Records...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-8 py-20 text-center text-gray-400 font-bold uppercase tracking-widest">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record._id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-[#319bab] tracking-tight">{record.salesInvoiceNumber}</span>
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="View Bill">
                            <FaEye size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-gray-700">{record.name}</td>
                      <td className="px-8 py-6 text-sm font-medium text-gray-500">{record.phoneNumber}</td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-black text-gray-800">₹{record.grandTotal?.toLocaleString()}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${record.cashAmount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          ₹{record.cashAmount?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${record.upiAmount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                          ₹{record.upiAmount?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-700">{new Date(record.dateTime).toLocaleDateString()}</span>
                          <span className="text-[10px] font-medium text-gray-400">{new Date(record.dateTime).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-[#319bab] uppercase tracking-tighter">{record.collectedByUsername || "N/A"}</span>
                          <span className="text-[8px] text-gray-400 font-bold">Staff / Admin</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchSpottedCustomerLedger;
