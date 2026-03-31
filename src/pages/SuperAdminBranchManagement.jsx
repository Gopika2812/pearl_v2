import { useEffect, useState } from "react";
import { FaBuilding, FaCheck, FaEdit, FaEnvelope, FaPhone, FaPlus, FaTimes, FaTrash, FaUser, FaUsers } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

export default function SuperAdminBranchManagement() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Check if user is SUPER_ADMIN
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      navigate("/super-admin-login");
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== "SUPER_ADMIN") {
      toast.error("You do not have permission to access this page");
      navigate("/branch-login");
      return;
    }
  }, [navigate]);

  // Branch Form
  const [branchForm, setBranchForm] = useState({
    name: "",
    code: "",
    location: "",
    address: "",
    phone: "",
    email: "",
    manager: "",
    isMainBranch: false,
    gstin: "",
    city: "",
    state: "Tamil Nadu",
    stateCode: "33",
    pincode: "",
  });


  // Fetch branches
  useEffect(() => {
    fetchBranches();
  }, []);

  // Fetch staff members when branch is selected
  useEffect(() => {
    if (selectedBranch) {
      fetchStaffMembers(selectedBranch._id);
    }
  }, [selectedBranch]);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_BASE}/branches`);
      const data = await res.json();
      if (data.success) {
        setBranches(data.data);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to load branches");
    }
  };

  const fetchStaffMembers = async (branchId) => {
    setLoadingStaff(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/branch-users/branch/${branchId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setStaffMembers(data.data || []);
      } else {
        setStaffMembers([]);
      }
    } catch (error) {
      console.error("Error fetching staff members:", error);
      setStaffMembers([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!branchForm.name || !branchForm.code) {
        toast.error("Branch name and code are required");
        setLoading(false);
        return;
      }

      const token = localStorage.getItem("token");
      const isEditing = editingBranch !== null;

      if (isEditing) {
        // Update branch
        const res = await fetch(`${API_BASE}/branches/${editingBranch._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(branchForm),
        });

        const data = await res.json();

        if (data.success) {
          toast.success(`✅ Branch updated: ${data.data.name}`);
          setBranches(branches.map((b) => (b._id === editingBranch._id ? data.data : b)));
          setSelectedBranch(data.data);
          setEditingBranch(null);
          setShowBranchModal(false);
          resetForm();
        } else {
          toast.error(data.message || "Failed to update branch");
        }
      } else {
        // Create new branch
        const res = await fetch(`${API_BASE}/branches`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(branchForm),
        });

        const data = await res.json();

        if (data.success) {
          toast.success(`✅ Branch created: ${data.data.name}`);
          setBranches([...branches, data.data]);
          setShowBranchModal(false);
          resetForm();
        } else {
          toast.error(data.message || "Failed to create branch");
        }
      }
    } catch (error) {
      console.error("Error creating/updating branch:", error);
      toast.error("Error creating/updating branch");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBranchForm({
      name: "",
      code: "",
      location: "",
      address: "",
      phone: "",
      email: "",
      manager: "",
      isMainBranch: false,
      gstin: "",
    });

    setEditingBranch(null);
  };

  const openEditModal = (branch) => {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      code: branch.code,
      location: branch.location || "",
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
      manager: branch.manager || "",
      isMainBranch: branch.isMainBranch || false,
      gstin: branch.gstin || "",
    });

    setShowBranchModal(true);
  };

  const closeModal = () => {
    setShowBranchModal(false);
    resetForm();
  };

  const handleDeleteBranch = async (branchId) => {
    if (!window.confirm("Are you sure you want to delete this branch?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/branches/${branchId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Branch deleted");
        setBranches(branches.filter((b) => b._id !== branchId));
        setSelectedBranch(null);
      } else {
        toast.error(data.message || "Failed to delete branch");
      }
    } catch (error) {
      console.error("Error deleting branch:", error);
      toast.error("Error deleting branch");
    }
  };

  const handleRemoveStaff = async (staffId) => {
    if (!window.confirm("Remove this staff member from the branch?")) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/branch-users/${staffId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Staff member removed");
        setStaffMembers(staffMembers.filter((s) => s._id !== staffId));
      } else {
        toast.error(data.message || "Failed to remove staff");
      }
    } catch (error) {
      console.error("Error removing staff:", error);
      toast.error("Error removing staff");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-secondary to-primary text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <FaBuilding />
                Branch Management
              </h1>
              <p className="text-blue-100">Create, edit and manage all branches system-wide</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowBranchModal(true);
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition"
            >
              <FaPlus />
              New Branch
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Branches List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-primary text-white p-4 font-bold">
                📍 Branches ({branches.length})
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {branches.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <p>No branches created yet</p>
                    <p className="text-sm mt-2">Click "New Branch" to get started</p>
                  </div>
                ) : (
                  branches.map((branch) => (
                    <div
                      key={branch._id}
                      onClick={() => setSelectedBranch(branch)}
                      className={`p-4 cursor-pointer transition ${
                        selectedBranch?._id === branch._id
                          ? "bg-primary/10 border-l-4 border-primary"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-bold text-gray-900">{branch.name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs font-bold">
                          {branch.code}
                        </span>
                        {branch.isMainBranch && (
                          <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded ml-2 text-xs font-bold">
                            MAIN
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {branch.location}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(branch);
                          }}
                          className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1 flex-1 justify-center"
                        >
                          <FaEdit size={12} />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBranch(branch._id);
                          }}
                          className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 flex-1 justify-center"
                        >
                          <FaTrash size={12} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Branch Details & Staff */}
          <div className="lg:col-span-2 space-y-6">
            {selectedBranch ? (
              <>
                {/* Branch Details Card */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {selectedBranch.name}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Code</p>
                      <p className="text-lg font-bold text-gray-900">{selectedBranch.code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Location</p>
                      <p className="text-gray-900">{selectedBranch.location || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Phone</p>
                      <p className="text-gray-900 flex items-center gap-2">
                        <FaPhone size={14} />
                        {selectedBranch.phone || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Email</p>
                      <p className="text-gray-900 flex items-center gap-2">
                        <FaEnvelope size={14} />
                        {selectedBranch.email || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">GSTIN</p>
                      <p className="text-gray-900 font-mono">{selectedBranch.gstin || "—"}</p>
                    </div>

                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-600 font-semibold">Address</p>
                      <p className="text-gray-900">{selectedBranch.address || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Manager</p>
                      <p className="text-gray-900">{selectedBranch.manager || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">Status</p>
                      <p className="text-gray-900 flex items-center gap-2">
                        {selectedBranch.status === "ACTIVE" ? (
                          <>
                            <FaCheck className="text-green-500" />
                            Active
                          </>
                        ) : (
                          <>
                            <FaTimes className="text-red-500" />
                            Inactive
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8 pt-6 border-t">
                    <button
                      onClick={() => openEditModal(selectedBranch)}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-bold transition flex items-center justify-center gap-2"
                    >
                      <FaEdit />
                      Edit Branch
                    </button>
                    <button
                      onClick={() => handleDeleteBranch(selectedBranch._id)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-bold transition flex items-center justify-center gap-2"
                    >
                      <FaTrash />
                      Delete Branch
                    </button>
                  </div>
                </div>

                {/* Staff Members Card */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-secondary to-primary text-white p-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <FaUsers />
                      Staff Members ({staffMembers.length})
                    </h3>
                    <p className="text-blue-100 text-sm mt-1">Approved users registered with this branch</p>
                  </div>

                  {loadingStaff ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin text-primary text-3xl mb-2">⟳</div>
                      <p className="text-gray-600">Loading staff...</p>
                    </div>
                  ) : staffMembers.length === 0 ? (
                    <div className="p-8 text-center">
                      <FaUser className="text-6xl text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No staff members registered for this branch</p>
                    </div>
                  ) : (
                    <div className="divide-y max-h-96 overflow-y-auto">
                      {staffMembers.map((staff) => (
                        <div key={staff._id} className="p-4 hover:bg-gray-50 transition">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-bold text-gray-900">{staff.username}</p>
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <FaEnvelope size={12} />
                                {staff.email}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-bold">
                                  {staff.role}
                                </span>
                                {staff.status === "ACTIVE" ? (
                                  <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded text-xs font-bold">
                                    <FaCheck className="inline mr-1" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-bold">
                                    Inactive
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveStaff(staff._id)}
                              className="ml-4 text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
                              title="Remove staff member"
                            >
                              <FaTrash size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <FaBuilding className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Select a branch to view details and staff</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-secondary to-primary text-white p-6 rounded-t-2xl sticky top-0">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FaBuilding />
                {editingBranch ? "Edit Branch" : "Create New Branch"}
              </h2>
            </div>

            <form onSubmit={handleCreateBranch} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pearl Foods - Tirunelveli"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Branch Code * {editingBranch && "(cannot be changed)"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PF-TRV"
                    value={branchForm.code}
                    onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                    disabled={editingBranch !== null}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tirunelveli"
                    value={branchForm.location}
                    onChange={(e) => setBranchForm({ ...branchForm, location: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="9429692970"
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="branch@email.com"
                    value={branchForm.email}
                    onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Manager
                  </label>
                  <input
                    type="text"
                    placeholder="Manager Name"
                    value={branchForm.manager}
                    onChange={(e) => setBranchForm({ ...branchForm, manager: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    value={branchForm.gstin}
                    onChange={(e) => setBranchForm({ ...branchForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tirunelveli"
                    value={branchForm.city}
                    onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tamil Nadu"
                    value={branchForm.state}
                    onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    State Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 33 (TN), 32 (KA), 29 (MH), 27 (TG)"
                    value={branchForm.stateCode}
                    onChange={(e) => setBranchForm({ ...branchForm, stateCode: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Pincode
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 627003"
                    value={branchForm.pincode}
                    onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    placeholder="Full address"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    rows="3"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mainBranch"
                    checked={branchForm.isMainBranch}
                    onChange={(e) => setBranchForm({ ...branchForm, isMainBranch: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="mainBranch" className="font-bold text-gray-700">
                    Mark as Main Branch
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary text-white py-2 rounded-lg font-bold hover:bg-opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FaCheck />
                  {loading ? "Saving..." : editingBranch ? "Update Branch" : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
