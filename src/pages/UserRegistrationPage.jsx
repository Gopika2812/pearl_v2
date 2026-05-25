import { useState } from "react";
import { FaBarcode, FaBriefcase, FaEnvelope, FaLock, FaUser, FaUserPlus, FaEye, FaEyeSlash, FaShieldAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

const ROLES = [
  { value: "ADMIN", label: "Admin (Full Branch Access)" },
  { value: "MANAGER", label: "Manager (Operations)" },
  { value: "SALES_OWNER", label: "Sales Owner" },
  { value: "SALESMAN", label: "Salesman" },
  { value: "DELIVERY_MAN", label: "Delivery Man" },
];

export default function UserRegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState("form"); // "form" or "otp"
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    branchCode: "",
    role: "ADMIN",
  });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationId, setRegistrationId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Dynamic multi-branch inputs
  const [branchCodes, setBranchCodes] = useState([""]);

  const addBranchCodeField = () => {
    setBranchCodes([...branchCodes, ""]);
  };

  const removeBranchCodeField = (index) => {
    if (branchCodes.length === 1) return;
    const updated = [...branchCodes];
    updated.splice(index, 1);
    setBranchCodes(updated);
  };

  const handleBranchCodeChange = (index, value) => {
    const updated = [...branchCodes];
    updated[index] = value;
    setBranchCodes(updated);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast.error("Full name is required");
      return;
    }

    if (!formData.username.trim()) {
      toast.error("Username is required");
      return;
    }

    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!formData.password) {
      toast.error("Password is required");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const activeCodes = branchCodes.map(c => c.trim()).filter(Boolean);
    if (activeCodes.length === 0) {
      toast.error("At least one deployment code is required");
      return;
    }
    const combinedBranchCodes = activeCodes.join(", ");

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/branch-users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          branchCode: combinedBranchCodes,
          role: formData.role,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.message || "Registration failed");
        setLoading(false);
        return;
      }

      toast.success("✅ Registration successful! Redirecting to login...");
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

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    if (!otp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }

    if (otp.length !== 6) {
      toast.error("OTP must be 6 digits");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/branch-users/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          otp,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.message || "Invalid OTP");
        setLoading(false);
        return;
      }

      toast.success("✅ Registration confirmed! You can now login.");

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/branch-login");
      }, 2000);
    } catch (error) {
      console.error("OTP verification error:", error);
      toast.error("OTP verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#001f3f] flex items-center justify-center p-4 py-12 font-poppins overflow-hidden relative">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-sky-400/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-indigo-500/10 rounded-full blur-[120px] animate-pulse transition-all duration-1000"></div>
      </div>

      <div className="bg-white/95 backdrop-blur-xl rounded-[40px] shadow-2xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-500 relative z-10">
        {/* Branding Side */}
        <div className="hidden md:flex md:w-5/12 bg-secondary p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-10 right-10 w-64 h-64 border-4 border-white rounded-full"></div>
            <div className="absolute bottom-20 -left-10 w-96 h-96 border-8 border-white rounded-full"></div>
          </div>
          
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/20 shadow-xl">
              <FaShieldAlt className="text-3xl text-sky-400" />
            </div>
            <h2 className="text-4xl font-black text-white leading-tight mb-4 uppercase tracking-tighter">
              Join the <br />
              <span className="text-sky-400">Network</span> <br />
              Registration
            </h2>
            <p className="text-white/60 font-medium text-lg max-w-xs">
              Onboard your terminal and start managing your branch operations with precision.
            </p>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-4 text-white/40 text-sm font-black uppercase tracking-widest">
              <div className="w-8 h-[2px] bg-sky-400"></div>
              Network Node v2.0
            </div>
          </div>
        </div>

        {/* Form Side */}
        <div className="w-full md:w-7/12 p-8 md:p-12 bg-white">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-secondary mb-2 uppercase tracking-tight">Identity Provisioning</h1>
            <p className="text-secondary/40 font-bold text-xs uppercase tracking-[0.2em]">Enter your administrative details</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">Legal Name</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-sky-500 transition-colors">
                    <FaUser size={14} />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Full Name"
                    className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-sky-500 focus:bg-white transition-all outline-none font-bold text-sm text-secondary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">Identity ID</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-sky-500 transition-colors">
                    <FaUser size={14} />
                  </div>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Username"
                    className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-sky-500 focus:bg-white transition-all outline-none font-bold text-sm text-secondary"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">Communication Endpoint</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-sky-500 transition-colors">
                  <FaEnvelope size={14} />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Official Email Address"
                  className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-sky-500 focus:bg-white transition-all outline-none font-bold text-sm text-secondary"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2 sm:col-span-2 bg-gray-50/50 p-6 rounded-[25px] border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">Deployment Code(s)</label>
                  <button
                    type="button"
                    onClick={addBranchCodeField}
                    className="text-[9px] font-black text-sky-500 hover:text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-xl uppercase tracking-wider transition-all"
                  >
                    + Add Branch Code
                  </button>
                </div>
                <div className="space-y-3">
                  {branchCodes.map((code, index) => (
                    <div key={index} className="flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
                      <div className="relative flex-1 group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-sky-500 transition-colors pointer-events-none">
                          <FaBarcode size={14} />
                        </div>
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => handleBranchCodeChange(index, e.target.value)}
                          placeholder={`e.g. PFC00${index + 1}`}
                          className="w-full pl-14 pr-4 py-3.5 bg-white border-2 border-gray-100 focus:border-sky-500 rounded-[20px] transition-all outline-none font-bold text-sm text-secondary uppercase"
                          required
                        />
                      </div>
                      {branchCodes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBranchCodeField(index)}
                          className="p-3.5 rounded-[20px] bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 transition-all shadow-sm"
                          title="Remove Code"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-secondary/40 font-bold uppercase tracking-wider mt-2 ml-1">
                  Specify all branch codes you require access to (e.g. PFC001). Access must be authorized by Super Admin.
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">Protocol Level</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-sky-500 transition-colors pointer-events-none">
                    <FaBriefcase size={14} />
                  </div>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-sky-500 focus:bg-white transition-all outline-none font-bold text-sm text-secondary appearance-none"
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">Secure Protocol</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-sky-500 transition-colors">
                    <FaLock size={14} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Create Password"
                    className="w-full pl-14 pr-12 py-4 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-sky-500 focus:bg-white transition-all outline-none font-bold text-sm text-secondary"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-secondary/20 hover:text-sky-500 transition-colors"
                  >
                    {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">Confirm Protocol</label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-sky-500 transition-colors">
                    <FaLock size={14} />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat Password"
                    className="w-full pl-14 pr-12 py-4 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-sky-500 focus:bg-white transition-all outline-none font-bold text-sm text-secondary"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-secondary/20 hover:text-sky-500 transition-colors"
                  >
                    {showConfirmPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary hover:bg-secondary/90 text-white font-black py-4 rounded-[20px] shadow-xl shadow-secondary/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50 mt-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <FaUserPlus /> Provision Identity
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => navigate("/branch-login")}
              className="text-secondary/40 hover:text-secondary font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Already have an account? <span className="text-sky-500 underline decoration-sky-500/30 underline-offset-4 ml-1">Authenticate here</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
