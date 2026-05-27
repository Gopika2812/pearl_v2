import { useState, useEffect, useRef, useCallback } from "react";
import { 
  FaBrain, FaRobot, FaPaperPlane, FaSpinner, FaBoxes, FaExclamationTriangle, 
  FaBuilding, FaArrowRight, FaUndo, FaCheckCircle, FaTrash, FaPlus, FaTimes, 
  FaCalendarAlt, FaMoneyBillWave, FaChartLine, FaTruckLoading, FaEdit
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../api";
import { useNavigate } from "react-router-dom";

export default function AIProcurementAssistantPage() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  
  // Dashboard & Suggestions Data
  const [stats, setStats] = useState({
    totalItems: 0,
    outOfStockCount: 0,
    criticalCount: 0,
    lowStockCount: 0,
    totalStockValue: 0,
    pendingPOCount: 0,
  });
  const [alerts, setAlerts] = useState([]);
  const [fastMoving, setFastMoving] = useState([]);
  const [slowMoving, setSlowMoving] = useState([]);
  const [pendingPOs, setPendingPOs] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  
  // Loaders
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // PO Modal State
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poModalLoading, setPoModalLoading] = useState(false);
  const [poTargetVendor, setPoTargetVendor] = useState(null); // { vendorId, vendorName, items: [] }

  // Multi-select & Grouped PO states
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("All");
  const [poGroups, setPoGroups] = useState([]); // Array of { vendorId, vendorName, items: [...] }
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  // Check authentication & role on load
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      navigate("/super-admin-login");
      return;
    }

    try {
      const user = JSON.parse(userData);
      if (user.role !== "SUPER_ADMIN") {
        toast.error("Unauthorized: Super Admin role required");
        navigate("/branch-login");
        return;
      }
    } catch (e) {
      console.error(e);
      navigate("/super-admin-login");
    }
  }, [navigate]);

  // Fetch branch list
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setBranchesLoading(true);
        const res = await fetchWithAuth(`${API_BASE}/super-admin/branches`);
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          setBranches(data.data);
          setSelectedBranch(data.data[0]._id); // Auto-select first branch
        } else {
          toast.error("Failed to load branches");
        }
      } catch (err) {
        console.error("Fetch branches error:", err);
        toast.error("Error loading branches");
      } finally {
        setBranchesLoading(false);
      }
    };
    fetchBranches();
  }, []);

  // Fetch Dashboard & Suggestions Data for selected branch
  const fetchBranchData = useCallback(async (branchId) => {
    if (!branchId) return;

    try {
      setDashboardLoading(true);
      setSuggestionsLoading(true);

      // 1. Fetch dashboard analytics
      const dbRes = await fetchWithAuth(`${API_BASE}/super-admin/ai-procurement/dashboard?branchId=${branchId}`);
      const dbData = await dbRes.json();
      if (dbData.success) {
        setStats(dbData.data.stats);
        setAlerts(dbData.data.alerts);
        setFastMoving(dbData.data.fastMoving);
        setSlowMoving(dbData.data.slowMoving);
        setPendingPOs(dbData.data.pendingPOs);
      } else {
        toast.error(dbData.message || "Failed to load dashboard data");
      }

      // 2. Fetch suggestions
      const sugRes = await fetchWithAuth(`${API_BASE}/super-admin/ai-procurement/suggestions?branchId=${branchId}`);
      const sugData = await sugRes.json();
      if (sugData.success) {
        setSuggestions(sugData.data);
      } else {
        toast.error(sugData.message || "Failed to load reorder suggestions");
      }

      // Reset chat to default greeting
      setChatMessages([
        { 
          role: "bot", 
          text: "👋 **Hello! I'm your AI Procurement Assistant.**\n\nI analyze sales velocity, lead times, and current stock level vectors to automate Purchase Order planning. Feel free to ask me anything about your inventory!" 
        }
      ]);

    } catch (err) {
      console.error("Error fetching branch data:", err);
      toast.error("Error loading branch procurement analytics");
    } finally {
      setDashboardLoading(false);
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedProductIds([]);
    setPoGroups([]);
    setGroupModalOpen(false);
    setSelectedGroupFilter("All");
    if (selectedBranch) {
      fetchBranchData(selectedBranch);
    }
  }, [selectedBranch, fetchBranchData]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Send message to chatbot
  const handleSendMessage = async (customQuery = "") => {
    const textToSend = customQuery || chatInput;
    if (!textToSend.trim() || !selectedBranch) return;

    // Add user message
    setChatMessages(prev => [...prev, { role: "user", text: textToSend }]);
    if (!customQuery) setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetchWithAuth(`${API_BASE}/super-admin/ai-procurement/chat`, {
        method: "POST",
        body: JSON.stringify({
          branchId: selectedBranch,
          query: textToSend
        })
      });

      const data = await res.json();
      if (data.success) {
        setChatMessages(prev => [...prev, { role: "bot", text: data.data.response }]);
      } else {
        toast.error("Failed to fetch response");
        setChatMessages(prev => [...prev, { role: "bot", text: "❌ *Failed to retrieve AI analysis. Please try again.*" }]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, { role: "bot", text: "❌ *Network error connecting to AI agent.*" }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Open the PO confirmation modal with a group of suggested items for a vendor
  const handleInitiatePO = (vendorName, vendorId, initialItem = null) => {
    let poItems = [];

    if (initialItem) {
      // Order a single item
      poItems = [{
        productId: initialItem.productId,
        productName: initialItem.productName,
        qty: initialItem.suggestedQty,
        purchasePrice: initialItem.costPrice,
        gst: initialItem.gst || 0,
        units: initialItem.units || "units"
      }];
    } else {
      // Batch order all items suggested for this vendor
      poItems = suggestions
        .filter(s => s.vendorName === vendorName && s.vendorId === vendorId)
        .map(s => ({
          productId: s.productId,
          productName: s.productName,
          qty: s.suggestedQty,
          purchasePrice: s.costPrice,
          gst: s.gst || 0,
          units: s.units || "units"
        }));
    }

    if (poItems.length === 0) {
      toast.warn("No suggested items to create a PO for");
      return;
    }

    setPoTargetVendor({
      vendorId,
      vendorName,
      items: poItems
    });
    setPoModalOpen(true);
  };

  const handlePlanSelectedPOs = () => {
    if (selectedProductIds.length === 0) return;

    // Group selected suggestions by vendor
    const selectedItems = suggestions.filter(s => selectedProductIds.includes(s.productId));
    
    const groupsMap = new Map();
    selectedItems.forEach(item => {
      const vKey = item.vendorId ? item.vendorId.toString() : `name_${item.vendorName}`;
      if (!groupsMap.has(vKey)) {
        groupsMap.set(vKey, {
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          items: []
        });
      }
      groupsMap.get(vKey).items.push({
        productId: item.productId,
        productName: item.productName,
        qty: item.suggestedQty,
        purchasePrice: item.costPrice,
        gst: item.gst || 0,
        units: item.units || "units"
      });
    });

    const groups = Array.from(groupsMap.values());

    if (groups.length === 1) {
      // Only 1 vendor is selected, open the standard PO draft modal directly
      const singleGroup = groups[0];
      setPoTargetVendor({
        vendorId: singleGroup.vendorId,
        vendorName: singleGroup.vendorName,
        items: singleGroup.items
      });
      setPoModalOpen(true);
    } else {
      // Multiple vendors selected, open intermediate selection modal
      setPoGroups(groups);
      setGroupModalOpen(true);
    }
  };

  // Handle manual quantity or price override in the PO confirmation modal
  const handleOverrideItem = (index, field, value) => {
    if (!poTargetVendor) return;
    const updatedItems = [...poTargetVendor.items];
    updatedItems[index][field] = Number(value);
    setPoTargetVendor({
      ...poTargetVendor,
      items: updatedItems
    });
  };

  const handleRemoveItemFromPO = (index) => {
    if (!poTargetVendor) return;
    const updatedItems = poTargetVendor.items.filter((_, idx) => idx !== index);
    if (updatedItems.length === 0) {
      setPoModalOpen(false);
      setPoTargetVendor(null);
    } else {
      setPoTargetVendor({
        ...poTargetVendor,
        items: updatedItems
      });
    }
  };

  // Persist the Purchase Order to the backend database
  const handleConfirmAndCreatePO = async () => {
    if (!poTargetVendor || poTargetVendor.items.length === 0) return;

    try {
      setPoModalLoading(true);

      const res = await fetchWithAuth(`${API_BASE}/super-admin/ai-procurement/create-po`, {
        method: "POST",
        body: JSON.stringify({
          branchId: selectedBranch,
          vendorId: poTargetVendor.vendorId,
          items: poTargetVendor.items.map(item => ({
            productId: item.productId,
            qty: item.qty,
            purchasePrice: item.purchasePrice
          }))
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`🎉 ${data.message}`);
        setPoModalOpen(false);
        setPoTargetVendor(null);
        
        // If we were planning from a group, filter out the supplier we just created the PO for
        const completedProductIds = poTargetVendor.items.map(item => item.productId);
        if (poGroups.length > 0) {
          const updatedGroups = poGroups.filter(g => g.vendorId !== poTargetVendor.vendorId);
          setPoGroups(updatedGroups);
          setSelectedProductIds(prev => prev.filter(id => !completedProductIds.includes(id)));
          if (updatedGroups.length === 0) {
            setGroupModalOpen(false);
            setSelectedProductIds([]);
          }
        } else {
          setSelectedProductIds(prev => prev.filter(id => !completedProductIds.includes(id)));
        }

        // Refresh dashboard statistics and recommendations
        fetchBranchData(selectedBranch);
      } else {
        toast.error(data.message || "Failed to create Purchase Order");
      }
    } catch (err) {
      console.error("Create PO error:", err);
      toast.error("Network error while creating Purchase Order");
    } finally {
      setPoModalLoading(false);
    }
  };

  // Helper to format currency in INR
  const formatINR = (val) => {
    return `₹${Math.round(val).toLocaleString("en-IN")}`;
  };

  // Calculate totals for the PO confirmation modal
  const calculatePOTotals = () => {
    if (!poTargetVendor) return { subtotal: 0, tax: 0, grandTotal: 0 };
    let subtotal = 0;
    let tax = 0;

    poTargetVendor.items.forEach(item => {
      const row = item.qty * item.purchasePrice;
      const rowTax = (row * (item.gst || 0)) / 100;
      subtotal += row;
      tax += rowTax;
    });

    return {
      subtotal,
      tax,
      grandTotal: Math.round(subtotal + tax)
    };
  };

  const poTotals = calculatePOTotals();

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-poppins text-secondary">
      <div className="max-w-[1700px] mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-secondary flex items-center gap-3 tracking-tight">
              <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-600/10">
                <FaBrain size={24} className="animate-pulse" />
              </div>
              AI Inventory & PO Planning Assistant
            </h1>
            <p className="text-secondary/60 mt-1 font-medium text-sm">
              Smart restocking predictions, velocity analytics, and draft Purchase Orders for Super Admins.
            </p>
          </div>

          {/* Branch Dropdown */}
          <div className="flex items-center gap-3 bg-white border border-gray-100 shadow-sm p-4 rounded-2xl">
            <FaBuilding className="text-indigo-600 text-lg" />
            <span className="font-bold text-xs uppercase tracking-wider text-secondary/60">Branch:</span>
            {branchesLoading ? (
              <FaSpinner className="animate-spin text-indigo-600" />
            ) : (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent text-secondary text-sm font-black focus:outline-none cursor-pointer pr-4"
              >
                {branches.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Out of Stock", value: stats.outOfStockCount, icon: <FaBoxes />, color: "text-rose-600 bg-rose-50 border-rose-100" },
            { label: "Critical Stock", value: stats.criticalCount, icon: <FaExclamationTriangle />, color: "text-amber-600 bg-amber-50 border-amber-100" },
            { label: "Low Stock", value: stats.lowStockCount, icon: <FaExclamationTriangle />, color: "text-yellow-600 bg-yellow-50 border-yellow-100" },
            { label: "Total Catalog", value: stats.totalItems, icon: <FaBoxes />, color: "text-blue-600 bg-blue-50 border-blue-100" },
            { label: "Inventory Value", value: formatINR(stats.totalStockValue), icon: <FaMoneyBillWave />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
            { label: "Pending POs", value: stats.pendingPOCount, icon: <FaTruckLoading />, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
          ].map((stat, idx) => (
            <div key={idx} className={`p-4 bg-white border rounded-2xl shadow-sm flex items-center gap-4 ${dashboardLoading ? "opacity-50" : ""}`}>
              <div className={`p-3 rounded-xl text-lg ${stat.color.split(" ")[0]} ${stat.color.split(" ")[1]}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-secondary/40 text-[9px] font-black uppercase tracking-widest">{stat.label}</p>
                <p className="text-lg font-black text-secondary leading-tight mt-0.5">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dashboard Panels */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: Chatbot and AI Insights */}
          <div className="xl:col-span-5 space-y-6">
            
            {/* Chatbot Interface */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-[32px] overflow-hidden flex flex-col h-[520px] relative">
              
              {/* Chat Title */}
              <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 px-6 py-5 flex items-center justify-between text-white border-b border-indigo-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <FaRobot className="text-white text-lg" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm tracking-wide uppercase">Procurement Copilot</h3>
                    <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">HIG AI Automation LLP engine</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setChatMessages([
                      { 
                        role: "bot", 
                        text: "👋 **Hello! I'm your AI Procurement Assistant.**\n\nI analyze sales velocity, lead times, and current stock level vectors to automate Purchase Order planning. Feel free to ask me anything about your inventory!" 
                      }
                    ]);
                    toast.info("Chat cleared");
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
                  title="Clear Chat"
                >
                  <FaTrash size={14} />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed shadow-sm font-semibold whitespace-pre-wrap ${
                      msg.role === "user" 
                        ? "bg-indigo-600 text-white rounded-br-none" 
                        : "bg-white text-secondary rounded-bl-none border border-slate-100"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white text-secondary p-4 rounded-2xl rounded-bl-none border border-slate-100 flex items-center gap-2 text-xs font-semibold">
                      <FaSpinner className="animate-spin text-indigo-600" />
                      Analyzing inventory vectors...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Quick Prompts */}
              <div className="px-6 py-3 bg-white border-t border-slate-50 flex gap-2 overflow-x-auto no-scrollbar">
                {[
                  "Urgent restocks?",
                  "Stockout warnings?",
                  "Top fast-moving?",
                  "Slow-moving items?"
                ].map((promptText, idx) => (
                  <button
                    key={idx}
                    disabled={chatLoading}
                    onClick={() => handleSendMessage(promptText)}
                    className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-secondary/70 hover:text-secondary rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    {promptText}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about stockouts, reorder quantities, or planning POs..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={chatLoading}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-indigo-600"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center shadow-lg transition-all"
                >
                  <FaPaperPlane />
                </button>
              </div>

            </div>

            {/* AI Insights Card */}
            <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px]">
              <h4 className="text-xs font-black uppercase tracking-wider text-secondary/40 mb-4 flex items-center gap-2">
                <FaBrain className="text-indigo-600" /> AI Insights Summary
              </h4>
              <div className="space-y-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-700 leading-relaxed">
                    Based on sales trends from the past 30 days, we suggest checking supplier lead times for critical items. Placing orders today ensures arrival before predicted stockout dates.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT PANEL: Analytics, Out of stock and Reorder tables */}
          <div className="xl:col-span-7 space-y-8">
            
            {/* Urgent Alerts and Depletion Forecasts */}
            <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[32px]">
              <h3 className="text-lg font-black text-secondary tracking-tight mb-4 flex items-center gap-2">
                <FaExclamationTriangle className="text-rose-600" />
                Critical & Out of Stock Alerts
              </h3>
              
              {dashboardLoading ? (
                <div className="py-12 flex justify-center"><FaSpinner className="animate-spin text-indigo-600 text-3xl" /></div>
              ) : alerts.length === 0 ? (
                <div className="p-8 text-center text-secondary/40 text-sm font-bold border border-dashed border-slate-200 rounded-2xl">
                  No stockout alerts at this time. All items are healthy!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
                  {alerts.map((item, idx) => (
                    <div key={idx} className="p-4 bg-white border border-slate-100 hover:border-slate-200 rounded-2xl shadow-sm transition-all flex flex-col justify-between">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h4 className="text-xs font-black text-secondary line-clamp-1">{item.name}</h4>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.hsnCode || "No HSN"}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter ${
                          item.effectiveAvailable === 0 
                            ? "bg-rose-100 text-rose-600" 
                            : "bg-amber-100 text-amber-600"
                        }`}>
                          {item.effectiveAvailable === 0 ? "OUT OF STOCK" : "CRITICAL"}
                        </span>
                      </div>
                      
                      <div className="mt-4 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                          <span>Stock: {item.effectiveAvailable} / {item.minStockQty} {item.units}</span>
                          <span className="text-indigo-600 font-black">
                            {item.daysUntilStockout === 0 ? "Stockout now" : `${item.daysUntilStockout} days left`}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${item.effectiveAvailable === 0 ? "bg-rose-500 w-0" : "bg-amber-500"}`}
                            style={{ width: `${Math.min(100, (item.effectiveAvailable / item.minStockQty) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Smart Purchase Recommendations (Suggestions) */}
            <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[32px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-black text-secondary tracking-tight flex items-center gap-2">
                    <FaRobot className="text-indigo-600" />
                    AI Restocking Recommendations
                  </h3>
                  <p className="text-xs text-secondary/40 font-semibold mt-0.5">Calculated using lead time, sales velocity, and safety margins.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* Product Group Filter Dropdown */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Group:</span>
                    <select
                      value={selectedGroupFilter}
                      onChange={(e) => setSelectedGroupFilter(e.target.value)}
                      className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="All">All Groups</option>
                      {Array.from(new Set(suggestions.map(s => s.productGroupName).filter(Boolean))).map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {selectedProductIds.length > 0 && (
                    <button
                      onClick={handlePlanSelectedPOs}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2"
                    >
                      <FaPlus />
                      Plan PO for Selected ({selectedProductIds.length})
                    </button>
                  )}
                </div>
              </div>

              {suggestionsLoading ? (
                <div className="py-16 flex justify-center"><FaSpinner className="animate-spin text-indigo-600 text-3xl" /></div>
              ) : suggestions.length === 0 ? (
                <div className="p-12 text-center text-secondary/40 text-sm font-bold border border-dashed border-slate-200 rounded-2xl">
                  No purchase suggestions needed right now.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-semibold text-secondary">
                    <thead>
                      <tr className="border-b border-slate-100 text-secondary/40 uppercase tracking-widest text-[9px]">
                        <th className="py-3 px-4 text-center font-black w-10">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                            checked={
                              (() => {
                                const filtered = selectedGroupFilter === "All"
                                  ? suggestions
                                  : suggestions.filter(s => s.productGroupName === selectedGroupFilter);
                                return filtered.length > 0 && filtered.every(s => selectedProductIds.includes(s.productId));
                              })()
                            }
                            onChange={(e) => {
                              const filtered = selectedGroupFilter === "All"
                                ? suggestions
                                : suggestions.filter(s => s.productGroupName === selectedGroupFilter);
                              const filteredIds = filtered.map(s => s.productId);
                              if (e.target.checked) {
                                setSelectedProductIds(prev => Array.from(new Set([...prev, ...filteredIds])));
                              } else {
                                setSelectedProductIds(prev => prev.filter(id => !filteredIds.includes(id)));
                              }
                            }}
                          />
                        </th>
                        <th className="py-3 font-black">Product</th>
                        <th className="py-3 font-black">Suggested Vendor</th>
                        <th className="py-3 font-black text-center">Suggested Qty</th>
                        <th className="py-3 font-black text-right">Est. Total</th>
                        <th className="py-3 font-black text-center">Expected Delivery</th>
                        <th className="py-3 font-black text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(selectedGroupFilter === "All"
                        ? suggestions
                        : suggestions.filter(s => s.productGroupName === selectedGroupFilter)
                      ).map((sug, idx) => (
                        <tr key={sug.productId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-4 text-center">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                              checked={selectedProductIds.includes(sug.productId)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProductIds(prev => [...prev, sug.productId]);
                                } else {
                                  setSelectedProductIds(prev => prev.filter(id => id !== sug.productId));
                                }
                              }}
                            />
                          </td>
                          <td className="py-4">
                            <div>
                              <p className="font-black text-slate-800 line-clamp-1">{sug.productName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-wide">
                                  {sug.productGroupName}
                                </span>
                                <span className="text-[9px] text-slate-400 uppercase tracking-widest">Stock: {sug.currentStock} {sug.units}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 font-bold text-slate-600">{sug.vendorName}</td>
                          <td className="py-4 text-center font-black text-indigo-600">{sug.suggestedQty} {sug.units}</td>
                          <td className="py-4 text-right font-black text-slate-800">{formatINR(sug.estTotal)}</td>
                          <td className="py-4 text-center text-slate-500 font-bold">
                            {new Date(sug.expectedReceivingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="py-4 text-center">
                            <button
                              onClick={() => handleInitiatePO(sug.vendorName, sug.vendorId, sug)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                            >
                              Plan PO
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Fast-Moving & Slow-Moving Products side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Fast-Moving */}
              <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px]">
                <h3 className="text-sm font-black text-secondary tracking-tight mb-4 flex items-center gap-2 uppercase tracking-widest text-secondary/60">
                  <FaChartLine className="text-emerald-500" /> Fast-Moving Products
                </h3>
                {dashboardLoading ? (
                  <div className="py-6 flex justify-center"><FaSpinner className="animate-spin text-indigo-600" /></div>
                ) : fastMoving.length === 0 ? (
                  <p className="text-xs font-bold text-secondary/40 text-center py-6">No sales velocity recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {fastMoving.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                        <div>
                          <p className="text-xs font-black text-slate-700 line-clamp-1">{item.name}</p>
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest">Velocity: {item.dailySalesRate} / day</span>
                        </div>
                        <span className="text-xs font-black text-emerald-600">+{item.thirtyDaySales} sold</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Slow-Moving */}
              <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[24px]">
                <h3 className="text-sm font-black text-secondary tracking-tight mb-4 flex items-center gap-2 uppercase tracking-widest text-secondary/60">
                  <FaUndo className="text-rose-500" /> Slow-Moving Products
                </h3>
                {dashboardLoading ? (
                  <div className="py-6 flex justify-center"><FaSpinner className="animate-spin text-indigo-600" /></div>
                ) : slowMoving.length === 0 ? (
                  <p className="text-xs font-bold text-secondary/40 text-center py-6">No slow-moving items in stock.</p>
                ) : (
                  <div className="space-y-3">
                    {slowMoving.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                        <div>
                          <p className="text-xs font-black text-slate-700 line-clamp-1">{item.name}</p>
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest">Unsold stock</span>
                        </div>
                        <span className="text-xs font-black text-slate-500">{item.effectiveAvailable} left</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Placed Purchase Orders (Receiving Schedule) */}
            <div className="bg-white border border-gray-100 shadow-sm p-6 rounded-[32px]">
              <h3 className="text-lg font-black text-secondary tracking-tight mb-4 flex items-center gap-2">
                <FaTruckLoading className="text-indigo-600" />
                Expected Receiving Schedule (Pending POs)
              </h3>
              
              {dashboardLoading ? (
                <div className="py-6 flex justify-center"><FaSpinner className="animate-spin text-indigo-600" /></div>
              ) : pendingPOs.length === 0 ? (
                <div className="p-8 text-center text-secondary/40 text-xs font-bold border border-dashed border-slate-200 rounded-2xl">
                  No pending Purchase Orders placed.
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {pendingPOs.map((po, idx) => (
                    <div key={idx} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800">{po.invoiceId}</span>
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest">PLACED</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">Supplier: {po.vendorName} • {po.itemsCount} items</p>
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-end">
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-800">{formatINR(po.grandTotal)}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                            Ordered: {new Date(po.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* ================= GROUPED VENDORS MODAL ================= */}
      {groupModalOpen && poGroups.length > 0 && (
        <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600/30 rounded-2xl flex items-center justify-center border border-white/20">
                  <FaBuilding className="text-xl text-indigo-200" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Select Supplier to Plan PO</h2>
                  <p className="text-indigo-200 font-bold text-[10px] uppercase tracking-widest mt-0.5">Grouped by Supplier</p>
                </div>
              </div>
              <button
                onClick={() => { setGroupModalOpen(false); setPoGroups([]); }}
                className="w-10 h-10 rounded-xl hover:bg-white/10 text-white flex items-center justify-center transition-colors relative z-10"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
              <div className="text-xs text-secondary/60 font-semibold mb-2">
                Your selected products are supplied by {poGroups.length} different vendors. Please plan the Purchase Order for each supplier individually:
              </div>

              <div className="space-y-4">
                {poGroups.map((group, idx) => {
                  // Calculate group totals
                  let groupTotal = 0;
                  group.items.forEach(item => {
                    const row = item.qty * item.purchasePrice;
                    const rowTax = (row * (item.gst || 0)) / 100;
                    groupTotal += row + rowTax;
                  });

                  return (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-slate-200 transition-all">
                      <div>
                        <h4 className="text-sm font-black text-slate-800">{group.vendorName}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                          {group.items.length} {group.items.length === 1 ? "product" : "products"} suggested • Est. Total: {formatINR(groupTotal)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPoTargetVendor({
                            vendorId: group.vendorId,
                            vendorName: group.vendorName,
                            items: [...group.items]
                          });
                          setPoModalOpen(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shrink-0 self-start sm:self-center"
                      >
                        Plan PO
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 bg-white border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => { setGroupModalOpen(false); setPoGroups([]); }}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= PURCHASE ORDER CONFIRMATION MODAL ================= */}
      {poModalOpen && poTargetVendor && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600/30 rounded-2xl flex items-center justify-center border border-white/20">
                  <FaTruckLoading className="text-xl text-indigo-200" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Review Draft Purchase Order</h2>
                  <p className="text-indigo-200 font-bold text-[10px] uppercase tracking-widest mt-0.5">Supplier: {poTargetVendor.vendorName}</p>
                </div>
              </div>
              <button
                onClick={() => { setPoModalOpen(false); setPoTargetVendor(null); }}
                className="w-10 h-10 rounded-xl hover:bg-white/10 text-white flex items-center justify-center transition-colors relative z-10"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Order Items</h3>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 divide-y divide-slate-100">
                  {poTargetVendor.items.map((item, idx) => (
                    <div key={idx} className="pt-4 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-800 line-clamp-1">{item.productName}</p>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">GST Slab: {item.gst}%</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Qty field with manual override */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Qty:</span>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleOverrideItem(idx, "qty", e.target.value)}
                            className="w-16 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-black outline-none focus:border-indigo-600 focus:bg-white"
                          />
                          <span className="text-xs text-slate-500 font-bold">{item.units}</span>
                        </div>

                        {/* Price field with manual override */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Price:</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.purchasePrice}
                            onChange={(e) => handleOverrideItem(idx, "purchasePrice", e.target.value)}
                            className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-black outline-none focus:border-indigo-600 focus:bg-white"
                          />
                        </div>

                        {/* Row Total */}
                        <div className="w-20 text-right">
                          <span className="text-xs font-black text-slate-800">{formatINR(item.qty * item.purchasePrice * (1 + (item.gst || 0)/100))}</span>
                        </div>

                        {/* Delete Row button */}
                        <button
                          onClick={() => handleRemoveItemFromPO(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Subtotal</p>
                  <p className="text-sm font-black text-slate-800">{formatINR(poTotals.subtotal)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimated Tax</p>
                  <p className="text-sm font-black text-slate-800">{formatINR(poTotals.tax)}</p>
                </div>
                <div className="bg-indigo-50/50 p-2 rounded-2xl border border-indigo-100/50">
                  <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1">Grand Total</p>
                  <p className="text-base font-black text-indigo-600">{formatINR(poTotals.grandTotal)}</p>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
              <button
                disabled={poModalLoading}
                onClick={() => { setPoModalOpen(false); setPoTargetVendor(null); }}
                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Discard Draft
              </button>
              <button
                disabled={poModalLoading}
                onClick={handleConfirmAndCreatePO}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
              >
                {poModalLoading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <FaCheckCircle />
                    Confirm & Place Purchase Order
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
