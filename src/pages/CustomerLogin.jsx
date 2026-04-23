import { useState } from "react";
import { FaLock, FaWhatsapp, FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/customers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: whatsappNumber.replace(/\D/g, ""),
          password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store token and customer info
      localStorage.setItem("customerToken", data.token);
      localStorage.setItem("customerData", JSON.stringify(data.customer));

      navigate("/pearls-shopping");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#001f3f] flex items-center justify-center p-4 font-poppins overflow-hidden relative">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-emerald-400/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse transition-all duration-1000"></div>
      </div>

      <div className="bg-white/95 backdrop-blur-xl rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-500 relative z-10 p-10 md:p-14 text-center">
        {/* Header */}
        <div className="mb-10">
          <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20 rotate-3">
            <FaWhatsapp size={40} />
          </div>
          <h1 className="text-3xl font-black text-secondary uppercase tracking-tight">Customer Portal</h1>
          <p className="text-secondary/40 font-bold text-xs uppercase tracking-[0.2em] mt-1">Authenticate to start shopping</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">WhatsApp Identity</label>
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-emerald-500 transition-colors">
                <FaWhatsapp size={14} />
              </div>
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="Enter registered number"
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold text-sm text-secondary"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-secondary/40 uppercase tracking-widest ml-1">Secret Key</label>
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/20 group-focus-within:text-emerald-500 transition-colors">
                <FaLock size={14} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-14 pr-14 py-4 bg-gray-50 border-2 border-transparent rounded-[20px] focus:border-emerald-500 focus:bg-white transition-all outline-none font-bold text-sm text-secondary"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-secondary/20 hover:text-emerald-500 transition-colors"
              >
                {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 text-xs font-bold animate-shake">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-[20px] shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                Initiate Secure Shopping
              </>
            )}
          </button>
        </form>

        <div className="mt-12 space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Account Setup Required?</p>
          <p className="text-[11px] font-bold text-secondary/60 leading-relaxed px-4">
            Contact your local branch manager to register your WhatsApp number for online access.
          </p>
        </div>
      </div>
    </div>
  );
}
