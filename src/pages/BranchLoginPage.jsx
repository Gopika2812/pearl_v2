import { useState } from "react";
import { FaLock, FaSignInAlt, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";
import { useBranch } from "../context/BranchContext";

export default function BranchLoginPage() {
  const navigate = useNavigate();
  const { switchBranch } = useBranch();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error("Username and password are required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/branch-users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.message || "Invalid credentials");
        setLoading(false);
        return;
      }

      // Get user's branch from response
      const userBranch = data.data.branch;
      
      if (!userBranch) {
        toast.error("User branch information not found");
        setLoading(false);
        return;
      }

      // Ensure branchId is properly set (handle both _id and id)
      const branchId = userBranch._id || userBranch.id;

      // Store JWT token
      localStorage.setItem("token", data.token);
      
      // Store currentBranch with _id for consistency
      const normalizedBranch = {
        _id: branchId,
        id: branchId, // Keep both for compatibility
        name: userBranch.name,
        code: userBranch.code,
        location: userBranch.location,
      };
      localStorage.setItem("currentBranch", JSON.stringify(normalizedBranch));
      
      // Store user data with their branch
      const userData = {
        id: data.data.id,
        username: data.data.username,
        email: data.data.email,
        role: data.data.role,
        branch: normalizedBranch,
        branchId: branchId,
        branchName: userBranch.name,
        branchCode: userBranch.code,
      };
      localStorage.setItem("user", JSON.stringify(userData));

      // Store in context
      switchBranch(normalizedBranch, userData);

      toast.success(`✅ Welcome to ${userBranch.name}!`);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary to-primary flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Branch Login</h1>
          <p className="text-gray-600">Enter your credentials</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Username */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Username
            </label>
            <div className="relative">
              <FaUser className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <FaLock className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
              />
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FaSignInAlt />
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Links */}
        <div className="mt-8 space-y-2 text-center">
          <p className="text-gray-600 text-sm">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/user-register")}
              className="text-primary font-bold hover:underline"
            >
              Register here
            </button>
          </p>
          <p className="text-gray-600 text-sm">
            Are you a super admin?{" "}
            <button
              onClick={() => navigate("/super-admin-login")}
              className="text-primary font-bold hover:underline"
            >
              Login as Super Admin
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
