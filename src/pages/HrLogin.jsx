import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const HrLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    // User is logged in → JWT stored automatically by Supabase
    navigate("/"); // go to home/dashboard
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-2xl shadow border w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-primary text-center">
          Pearls ERP Login
        </h1>

        <div>
          <label className="text-sm text-gray-600">Email</label>
          <input
            type="email"
            className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-sm text-gray-600">Password</label>
          <input
            type="password"
            className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-2 rounded-lg hover:opacity-90 transition"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default HrLogin;
