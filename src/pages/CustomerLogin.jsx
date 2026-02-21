import { useState } from "react";
import { FaLock, FaWhatsapp } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* HEADER */}
        <div className="text-center mb-6">
          <div className="bg-primary/10 text-primary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaWhatsapp className="text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Pearls Shopping</h1>
          <p className="text-gray-500 text-sm mt-2">Login to continue shopping</p>
        </div>

        {/* FORM */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* WHATSAPP NUMBER */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              WhatsApp Number
            </label>
            <input
              type="tel"
              placeholder="Enter your WhatsApp number"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">The number linked to your customer account</p>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <FaLock className="absolute left-4 top-4 text-gray-400" />
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                required
              />
            </div>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* FOOTER */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Don't have an account?</p>
          <p>Contact us on WhatsApp for customer registration</p>
        </div>
      </div>
    </div>
  );
}
