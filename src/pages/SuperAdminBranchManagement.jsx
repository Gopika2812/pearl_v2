import { useEffect, useState } from "react";
import {
  FaBuilding, FaPlus, FaEdit, FaCheck, FaTimes,
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaGlobe, FaShieldAlt, FaUserCheck
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../api";
import { useBranch } from "../context/BranchContext";

const SuperAdminBranchManagement = () => {
  const navigate = useNavigate();
  const { setSuperAdminViewBranch } = useBranch();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  const [branchForm, setBranchForm] = useState({
    name: "",
    code: "",
    location: "",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    gpayNo: "",
    gstzenClientId: "",
    gstzenClientSecret: "",
    tokenBlockTime: 120,
    isMainBranch: false,
    manager: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/branches`);
      const data = await res.json();
      if (data.success) {
        setBranches(data.data || []);
        if (data.data?.length > 0 && !selectedBranch) {
          setSelectedBranch(data.data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch branches:", err);
      toast.error("Failed to load branches");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBranchForm({
      name: "",
      code: "",
      location: "",
      phone: "",
      email: "",
      address: "",
      gstin: "",
      gpayNo: "",
      gstzenClientId: "",
      gstzenClientSecret: "",
      tokenBlockTime: 120,
      isMainBranch: false,
      manager: "",
      status: "ACTIVE",
    });
    setEditingBranch(null);
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    try {
      const url = editingBranch
        ? `${API_BASE}/branches/${editingBranch._id}`
        : `${API_BASE}/branches`;
      const method = editingBranch ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(branchForm),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingBranch ? "Branch updated" : "Branch created");
        setShowBranchModal(false);
        resetForm();
        fetchBranches();
        
        // Update context if we just edited the active branch
        if (editingBranch && (selectedBranch?._id === editingBranch._id)) {
          setSuperAdminViewBranch(data.data);
        }
      } else {
        toast.error(data.message || "Operation failed");
      }
    } catch (err) {
      console.error("Error saving branch:", err);
      toast.error("An error occurred");
    }
  };

  const openEditModal = (branch) => {
    setEditingBranch(branch);
    setBranchForm({
      ...branch,
      tokenBlockTime: branch.tokenBlockTime || 120,
    });
    setShowBranchModal(true);
  };

  if (loading && branches.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin text-secondary text-4xl">⟳</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 pb-10 w-full font-poppins text-secondary">
      <div className="w-full">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <FaBuilding className="text-primary text-sm" />
              </span>
              Branch Management
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Configure and monitor system branch infrastructure
              <span className="ml-2 bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                {branches.length} active nodes
              </span>
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                if (selectedBranch) {
                  setSuperAdminViewBranch(selectedBranch);
                  navigate("/admin/attendance-report");
                } else {
                  toast.info("Please select a branch from the list first");
                }
              }}
              className="bg-white border border-gray-200 hover:border-primary hover:text-primary text-gray-500 px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <FaUserCheck size={12} />
              <span className="text-xs uppercase tracking-widest">Attendance Report</span>
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowBranchModal(true);
              }}
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
            >
              <FaPlus size={12} />
              <span className="text-xs uppercase tracking-widest">New Node</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Branch Directory */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-24">
              <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <h2 className="font-black text-[10px] uppercase tracking-widest text-gray-400">Directory</h2>
              </div>
              <div className="divide-y divide-gray-50 max-h-[calc(100vh-300px)] overflow-y-auto no-scrollbar">
                {branches.map((branch) => (
                  <div
                    key={branch._id}
                    onClick={() => setSelectedBranch(branch)}
                    className={`p-4 cursor-pointer transition-all relative group ${
                      selectedBranch?._id === branch._id
                        ? "bg-primary/5"
                        : "hover:bg-gray-50/70"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className={`font-bold text-sm ${selectedBranch?._id === branch._id ? "text-primary" : "text-gray-700"}`}>
                        {branch.name}
                      </div>
                      {branch.isMainBranch && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          HQ
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {branch.code} • {branch.location || "Remote"}
                    </div>
                    {selectedBranch?._id === branch._id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Branch Intelligence */}
          <div className="lg:col-span-8 xl:col-span-9">
            {selectedBranch ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Overview Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                  <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-white text-xl font-black shadow-lg shadow-secondary/20">
                        {selectedBranch.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight">
                          {selectedBranch.name}
                        </h2>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedBranch.code}</span>
                          <div className="w-1 h-1 rounded-full bg-gray-300" />
                          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${
                            selectedBranch.status === "ACTIVE" ? "text-primary" : "text-rose-500"
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${selectedBranch.status === "ACTIVE" ? "bg-primary" : "bg-rose-500"}`} />
                            {selectedBranch.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button
                        onClick={() => openEditModal(selectedBranch)}
                        className="bg-white border border-gray-200 hover:border-primary hover:text-primary text-gray-500 px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2"
                      >
                        <FaEdit size={12} />
                        Update Node
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-y-8 gap-x-8 border-t border-gray-50 pt-8">
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Communication</label>
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-3 text-xs font-bold text-gray-700">
                          <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400"><FaPhone size={10} /></div>
                          {selectedBranch.phone || "—"}
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold text-gray-700">
                          <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400"><FaEnvelope size={10} /></div>
                          <span className="truncate">{selectedBranch.email || "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Operational Data</label>
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-3 text-xs font-bold text-gray-700">
                          <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 text-[9px] font-black">GST</div>
                          {selectedBranch.gstin || "—"}
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold text-gray-700">
                          <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 text-[9px] font-black">PAY</div>
                          {selectedBranch.gpayNo || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Workflow Engine</label>
                      <div className="mt-2 p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <div className="text-[10px] font-bold text-gray-600 mb-1">Token Block Threshold</div>
                        <div className="text-lg font-black text-primary">{selectedBranch.tokenBlockTime || 120} <span className="text-[9px] uppercase">Minutes</span></div>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Primary Physical Address</label>
                      <div className="flex gap-3 text-xs font-bold text-gray-700 leading-relaxed bg-gray-50/50 p-4 rounded-xl mt-2">
                        <div className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-400 shrink-0"><FaMapMarkerAlt size={10} /></div>
                        {selectedBranch.address || "No address provided"}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Entity Leadership</label>
                      <div className="flex items-center gap-3 text-xs font-bold text-gray-700 bg-gray-50/50 p-4 rounded-xl mt-2">
                        <div className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-400 shrink-0"><FaShieldAlt size={10} /></div>
                        {selectedBranch.manager || "Unassigned"}
                      </div>
                    </div>

                  </div>
                </div>

                {/* API Integration Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 overflow-hidden relative">
                   <div className="absolute top-0 right-0 p-8 opacity-[0.02] rotate-12 pointer-events-none">
                     <FaGlobe size={100} />
                   </div>
                   <h3 className="text-sm font-black text-gray-800 mb-6 flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                     GSTZen Integration
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Client ID</div>
                        <div className="font-mono text-[10px] font-bold break-all text-gray-600">{selectedBranch.gstzenClientId || "Not Configured"}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Client Secret</div>
                        <div className="font-mono text-[10px] font-bold break-all text-gray-600">
                          {selectedBranch.gstzenClientSecret ? "••••••••••••••••••••••••" : "Not Configured"}
                        </div>
                      </div>
                   </div>
                </div>

              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-32 text-center flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-[24px] bg-gray-50 flex items-center justify-center text-gray-200 mb-6">
                  <FaBuilding size={32} />
                </div>
                <h2 className="text-xl font-black text-gray-800 mb-1">Select a Node</h2>
                <p className="text-gray-400 text-xs font-medium">Please choose a branch from the directory to view its operational intelligence.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-800">
                  {editingBranch ? "Modify Node" : "Initialize Node"}
                </h2>
                <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-1">Infrastructure Provisioning</p>
              </div>
              <button onClick={() => setShowBranchModal(false)} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-colors">
                <FaTimes size={12} />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="p-6 space-y-5 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Node Name</label>
                  <input
                    type="text"
                    required
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Node Code</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingBranch}
                    value={branchForm.code}
                    onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                    className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary transition-all outline-none font-bold text-sm ${
                      editingBranch ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-50"
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Location</label>
                  <input
                    type="text"
                    value={branchForm.location}
                    onChange={(e) => setBranchForm({ ...branchForm, location: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Protocol</label>
                  <input
                    type="text"
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Deployment Email</label>
                  <input
                    type="email"
                    value={branchForm.email}
                    onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">GSTIN Identifier</label>
                  <input
                    type="text"
                    value={branchForm.gstin}
                    onChange={(e) => setBranchForm({ ...branchForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">GPay No / UPI ID</label>
                  <input
                    type="text"
                    value={branchForm.gpayNo}
                    onChange={(e) => setBranchForm({ ...branchForm, gpayNo: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Token Delay (Mins)</label>
                  <input
                    type="number"
                    value={branchForm.tokenBlockTime}
                    onChange={(e) => setBranchForm({ ...branchForm, tokenBlockTime: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">GSTZen Client</label>
                  <input
                    type="text"
                    value={branchForm.gstzenClientId}
                    onChange={(e) => setBranchForm({ ...branchForm, gstzenClientId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-bold text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">GSTZen Secret</label>
                  <input
                    type="password"
                    value={branchForm.gstzenClientSecret}
                    onChange={(e) => setBranchForm({ ...branchForm, gstzenClientSecret: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-bold text-sm font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Physical Coordinates</label>
                <textarea
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none font-bold text-sm"
                />
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                 <input
                  type="checkbox"
                  id="isMain"
                  checked={branchForm.isMainBranch}
                  onChange={(e) => setBranchForm({ ...branchForm, isMainBranch: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                />
                <label htmlFor="isMain" className="text-xs font-bold text-gray-600 cursor-pointer">Designate as Headquarters Node</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-400 rounded-xl font-black text-xs hover:bg-gray-200 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-[2] px-4 py-3 bg-primary text-white rounded-xl font-black text-xs hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 uppercase tracking-widest"
                >
                  {editingBranch ? "Commit Updates" : "Initialize Node"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminBranchManagement;
