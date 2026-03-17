import { FaHome } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";

export default function BranchHome() {
  const { branch, user } = useBranch();

  return (
    <div className="min-h-screen bg-gray-100 pt-20 md:pt-4 md:pl-20 px-4 md:px-6 pb-10">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-secondary to-primary text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-start gap-4">
            <FaHome className="text-5xl opacity-80" />
            <div className="w-full">
              <h1 className="text-2xl font-bold mb-2">
                Welcome to {branch?.name}! 👋
              </h1>
              <p className="text-blue-100">
                Logged in as: <span className="font-bold">{user?.username}</span> ({user?.role})
              </p>
              <p className="text-blue-100">
                Location: <span className="font-bold">{branch?.location}</span>
              </p>
              <div className="mt-4">
                <Link
                  to="/branch/insights"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-secondary font-semibold hover:bg-blue-50 transition"
                >
                  View Insights
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-xs text-blue-100 font-semibold mb-1">Branch Code</p>
                  <p className="text-lg font-bold text-white">{branch?.code || "-"}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-xs text-blue-100 font-semibold mb-1">Phone</p>
                  <p className="text-lg font-bold text-white">{branch?.phone || "-"}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-xs text-blue-100 font-semibold mb-1">Manager</p>
                  <p className="text-lg font-bold text-white">{branch?.manager || "-"}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4 md:col-span-2 lg:col-span-3">
                  <p className="text-xs text-blue-100 font-semibold mb-1">Address</p>
                  <p className="text-base font-semibold text-white">{branch?.address || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
