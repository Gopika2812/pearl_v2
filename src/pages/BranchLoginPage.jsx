import { useState } from "react";
import { FaLock, FaSignInAlt, FaUser, FaEye, FaEyeSlash, FaShieldAlt } from "react-icons/fa";
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
  const [showPassword, setShowPassword] = useState(false);

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
        ...data.data, // Spread full user profile returned from API
        id: data.data._id || data.data.id,
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
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4 font-poppins overflow-hidden relative">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-[120px] animate-pulse transition-all duration-1000"></div>
      </div>

      <div className="bg-white/95 backdrop-blur-xl rounded-[40px] shadow-2xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-500 relative z-10">
        {/* Branding Side */}
        <div className="hidden md:flex md:w-1/2 bg-secondary p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-10 right-10 w-64 h-64 border-4 border-white rounded-full"></div>
            <div className="absolute bottom-20 -left-10 w-96 h-96 border-8 border-white rounded-full"></div>
          </div>
          
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/20 shadow-xl">
              <FaShieldAlt className="text-3xl text-primary" />
            </div>
            <h2 className="text-4xl font-black text-white leading-tight mb-4 uppercase tracking-tighter">
              The Next <br />
              <span className="text-primary">Generation</span> <br />
              ERP Platform
            </h2>
            <p className="text-white/60 font-medium text-lg max-w-sm">
              Secure, scalable, and intelligent business management for modern enterprises.
            </p>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-4 text-white/40 text-sm font-black uppercase tracking-widest">
              <div className="w-8 h-[2px] bg-primary"></div>
              Pearls ERP v2.0
            </div>
          </div>
        </div>

        {/* Login Form Side */}
        <div className="w-full md:w-1/2 p-10 md:p-16 flex flex-col justify-center bg-white">
          <div className="mb-10">
            <h1 className="text-3xl font-black text-secondary mb-2 uppercase tracking-tight">Access Terminal</h1>
            <p className="text-secondary/40 font-bold text-xs uppercase tracking-[0.2em]">Authorized Personnel Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">Identity ID</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-primary transition-colors">
                  <FaUser size={14} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-primary focus:bg-white transition-all outline-none font-bold text-sm text-secondary shadow-inner"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">Access Protocol</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-primary transition-colors">
                  <FaLock size={14} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-14 pr-14 py-4 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-primary focus:bg-white transition-all outline-none font-bold text-sm text-secondary shadow-inner"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-secondary/20 hover:text-primary transition-colors"
                >
                  {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary hover:bg-secondary/90 text-white font-black py-4 rounded-[20px] shadow-xl shadow-secondary/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <FaSignInAlt /> Initiate Session
                </>
              )}
            </button>
          </form>

          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-[1px] bg-gray-100"></div>
              <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">External Access</span>
              <div className="flex-1 h-[1px] bg-gray-100"></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => navigate("/user-register")}
                className="py-3 px-4 rounded-xl border-2 border-gray-100 text-secondary/60 hover:border-primary hover:text-primary font-black text-[10px] uppercase tracking-widest transition-all text-center"
              >
                Register Account
              </button>
              <button
                onClick={() => navigate("/super-admin-login")}
                className="py-3 px-4 rounded-xl border-2 border-gray-100 text-secondary/60 hover:border-primary hover:text-primary font-black text-[10px] uppercase tracking-widest transition-all text-center"
              >
                Super Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
