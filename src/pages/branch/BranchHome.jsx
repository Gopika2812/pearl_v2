import { FaHome } from "react-icons/fa";
import { useBranch } from "../../context/BranchContext";

export default function BranchHome() {
  const { branch, user } = useBranch();

  return (
    <div className="min-h-screen bg-gray-100 pt-20 md:pt-16 md:pl-64 px-4 md:px-6 pb-10">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-secondary to-primary text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center gap-4">
            <FaHome className="text-5xl opacity-80" />
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Welcome to {branch?.name}! 👋
              </h1>
              <p className="text-blue-100">
                Logged in as: <span className="font-bold">{user?.username}</span> ({user?.role})
              </p>
              <p className="text-blue-100">
                Location: <span className="font-bold">{branch?.location}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-bold">Purchase Orders</p>
                <p className="text-3xl font-bold text-primary mt-2">0</p>
              </div>
              <div className="text-5xl opacity-20">📦</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-bold">Sales Orders</p>
                <p className="text-3xl font-bold text-primary mt-2">0</p>
              </div>
              <div className="text-5xl opacity-20">🛒</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-bold">Total Payable</p>
                <p className="text-3xl font-bold text-red-600 mt-2">₹0</p>
              </div>
              <div className="text-5xl opacity-20">💳</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-bold">Total Receivable</p>
                <p className="text-3xl font-bold text-green-600 mt-2">₹0</p>
              </div>
              <div className="text-5xl opacity-20">💰</div>
            </div>
          </div>
        </div>

        {/* Branch Info */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Branch Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-gray-600 font-bold mb-2">Branch Name</p>
              <p className="text-lg text-gray-900">{branch?.name}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 font-bold mb-2">Branch Code</p>
              <p className="text-lg text-gray-900">{branch?.code}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 font-bold mb-2">Location</p>
              <p className="text-lg text-gray-900">{branch?.location}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 font-bold mb-2">Phone</p>
              <p className="text-lg text-gray-900">{branch?.phone || "—"}</p>
            </div>
            
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600 font-bold mb-2">Address</p>
              <p className="text-lg text-gray-900">{branch?.address || "—"}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 font-bold mb-2">Manager</p>
              <p className="text-lg text-gray-900">{branch?.manager || "—"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
