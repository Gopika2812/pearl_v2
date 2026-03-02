import { useEffect, useState } from "react";
import { FaBuilding, FaLock, FaMapMarkerAlt, FaPhone, FaSignInAlt, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";
import { useBranch } from "../context/BranchContext";

export default function BranchLoginPage() {
  const navigate = useNavigate();
  const { switchBranch } = useBranch();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // Fetch all branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch(`${API_BASE}/branches`);
        
        if (!res.ok) {
          throw new Error(`Backend returned ${res.status}`);
        }

        const data = await res.json();

        if (data.success && data.data?.length > 0) {
          setBranches(data.data);
          // Auto-select first branch (usually main branch)
          setSelectedBranch(data.data[0]);
        } else {
          toast.error("No branches available. Backend is responding but no data found.");
          console.error("Backend response:", data);
        }
      } catch (error) {
        console.error("❌ Error fetching branches:", error);
        console.error(
          "Backend URL:", API_BASE,
          "\nCheck if backend is deployed and accessible.",
          "\nIf using production URL, verify backend is running on Render."
        );
        toast.error(
          `Cannot reach backend: ${error.message}. ` +
          `Check that backend server is running at ${API_BASE}`
        );
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!selectedBranch) {
      toast.error("Please select a branch");
      return;
    }

    if (!username || !password) {
      toast.error("Username and password are required");
      return;
    }

    setLoading(true);

    try {
      // Call login API
      const res = await fetch(`${API_BASE}/branch-users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.message || "Invalid credentials");
        setLoading(false);
        return;
      }

      // User authenticated successfully
      const user = {
        username: data.data.username,
        email: data.data.email,
        role: data.data.role,
        branch: selectedBranch,
        branchId: selectedBranch._id,
        branchName: selectedBranch.name,
        loginTime: new Date().toISOString(),
      };

      // Store in context and localStorage
      switchBranch(selectedBranch, user);

      toast.success(`✅ Welcome to ${selectedBranch.name}!`);

      // Redirect to branch home
      setTimeout(() => {
        navigate("/branch-home");
      }, 1000);
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loadingBranches) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="animate-spin text-primary text-4xl mb-4">⟳</div>
          <p className="text-gray-600 font-semibold">Loading branches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary to-primary flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* LEFT SIDE - BRANCH SELECTION */}
          <div className="bg-gradient-to-b from-primary/10 to-transparent p-8 md:p-10">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <FaBuilding className="text-primary text-3xl" />
                <h2 className="text-2xl font-bold text-gray-900">Select Branch</h2>
              </div>
              <p className="text-gray-600 text-sm">Choose your working branch</p>
            </div>

            {/* Branch Dropdown */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Available Branches
              </label>
              <select
                value={selectedBranch?._id || ""}
                onChange={(e) => {
                  const branch = branches.find((b) => b._id === e.target.value);
                  setSelectedBranch(branch);
                }}
                className="w-full px-4 py-3 border-2 border-primary/30 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white text-gray-900 font-semibold transition"
              >
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                    {branch.isMainBranch ? " (Main)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Branch Details */}
            {selectedBranch && (
              <div className="bg-white rounded-xl border-2 border-primary/20 p-6 space-y-4">
                <div className="pb-4 border-b border-gray-200">
                  <h3 className="font-bold text-lg text-gray-900">{selectedBranch.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">
                    Code: <span className="font-semibold">{selectedBranch.code}</span>
                  </p>
                </div>

                {selectedBranch.location && (
                  <div className="flex gap-3 items-start">
                    <FaMapMarkerAlt className="text-primary mt-1 text-sm flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Location</p>
                      <p className="text-sm font-medium text-gray-900">{selectedBranch.location}</p>
                    </div>
                  </div>
                )}

                {selectedBranch.address && (
                  <div className="flex gap-3 items-start">
                    <FaBuilding className="text-primary mt-1 text-sm flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="text-sm font-medium text-gray-900">{selectedBranch.address}</p>
                    </div>
                  </div>
                )}

                {selectedBranch.phone && (
                  <div className="flex gap-3 items-start">
                    <FaPhone className="text-primary mt-1 text-sm flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="text-sm font-medium text-gray-900">{selectedBranch.phone}</p>
                    </div>
                  </div>
                )}

                {selectedBranch.manager && (
                  <div className="flex gap-3 items-start">
                    <FaUser className="text-primary mt-1 text-sm flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Manager</p>
                      <p className="text-sm font-medium text-gray-900">{selectedBranch.manager}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SIDE - LOGIN FORM */}
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Branch Login</h2>
              <p className="text-gray-600">Enter your credentials</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Username Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <FaUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <FaLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                  />
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-4 h-4 text-primary rounded focus:ring-2"
                />
                <label htmlFor="remember" className="text-sm text-gray-600">
                  Remember me
                </label>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-secondary to-primary text-white py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FaSignInAlt />
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            {/* Footer Note */}
            <p className="text-xs text-gray-500 text-center mt-8 pt-6 border-t border-gray-200">
              Data will be branch-specific after login
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
