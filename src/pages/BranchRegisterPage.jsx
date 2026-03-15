import { useEffect, useState } from "react";
import { FaBuilding, FaEnvelope, FaLock, FaMapMarkerAlt, FaPhone, FaUserPlus, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

export default function BranchRegisterPage() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("STAFF");
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
          setSelectedBranch(data.data[0]);
        } else {
          toast.error("No branches available");
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
        toast.error("Cannot reach backend. Please try again later.");
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!selectedBranch) {
      toast.error("Please select a branch");
      return;
    }

    if (!username || !password || !confirmPassword) {
      toast.error("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/branch-users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          branchId: selectedBranch._id,
          role: role, // Include selected role
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.message || "Registration failed");
        setLoading(false);
        return;
      }

      toast.success("✅ Registration successful! Please log in.");

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/branch-login");
      }, 2000);
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Registration failed. Please try again.");
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
              </div>
            )}
          </div>

          {/* RIGHT SIDE - REGISTRATION FORM */}
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
              <p className="text-gray-600 text-sm">Register to get started</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {/* Username Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <FaUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Choose username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email (Optional)
                </label>
                <div className="relative">
                  <FaEnvelope className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <FaLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  User Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                >
                  <option value="ADMIN">Admin (Full Access)</option>
                  <option value="MANAGER">Manager (Branch Operations)</option>
                  <option value="STAFF">Staff (Limited Access)</option>
                </select>
              </div>

              {/* Register Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 rounded-lg hover:shadow-lg transform hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
              >
                <FaUserPlus />
                {loading ? "Creating Account..." : "Register"}
              </button>

              {/* Login Link */}
              <div className="text-center mt-6 pt-6 border-t border-gray-200">
                <p className="text-gray-600 text-sm">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/branch-login")}
                    className="text-primary font-bold hover:underline"
                  >
                    Log in here
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
