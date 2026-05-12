import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaBoxes, FaPlus, FaTrash, FaCheck, FaSearch, FaTimes, FaHistory, FaChevronDown, FaDownload, FaPrint, FaSort, FaSortUp, FaSortDown } from "react-icons/fa";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

// Floating Multi-Select Component (Fixed position to avoid clipping)
const MultiUserSelect = ({ users, selected, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
    }
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        const menu = document.getElementById("floating-staff-menu");
        if (menu && menu.contains(event.target)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (u) => {
    const uId = u._id || u.id;
    const isSelected = selected.some(s => s.userId === uId);
    let updated;
    if (isSelected) {
      updated = selected.filter(s => s.userId !== uId);
    } else {
      updated = [...selected, { userId: uId, username: u.username || u.fullName }];
    }
    onChange(updated);
  };

  return (
    <div className="relative w-40" ref={containerRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-[11px] flex justify-between items-center cursor-pointer shadow-sm ${disabled ? "bg-gray-100 cursor-not-allowed" : "hover:border-blue-500"}`}
      >
        <span className="truncate font-bold text-gray-700">
          {selected.length === 0 ? "Select Staff" : `${selected.length} Selected`}
        </span>
        <FaChevronDown className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} size={8} />
      </div>

      {isOpen && (
        <div 
          id="floating-staff-menu"
          style={{ 
            position: "fixed", 
            top: coords.top + 32,
            left: coords.left,
            width: Math.max(coords.width, 220),
            zIndex: 99999
          }}
          className="bg-white border-2 border-blue-600 shadow-[0_20px_50px_rgba(0,0,0,0.4)] rounded-md overflow-hidden animate-in fade-in zoom-in duration-200"
        >
          <div className="max-h-64 overflow-y-auto p-1 bg-white">
            {users.length === 0 ? (
              <div className="p-4 text-center text-[10px] text-gray-400 font-black uppercase italic">No staff found</div>
            ) : (
              users.map(u => {
                const uId = u._id || u.id;
                const isChecked = selected.some(s => s.userId === uId);
                return (
                  <div 
                    key={uId} 
                    onClick={() => handleToggle(u)}
                    className={`flex items-center px-3 py-2.5 rounded mb-0.5 cursor-pointer transition-all ${isChecked ? "bg-blue-600 text-white shadow-inner" : "hover:bg-blue-50 text-gray-700"}`}
                  >
                    <div className={`w-4 h-4 border rounded flex items-center justify-center mr-3 ${isChecked ? "bg-white border-white" : "bg-white border-gray-300"}`}>
                      {isChecked && <FaCheck className="text-blue-600" size={10} />}
                    </div>
                    <span className="text-[11px] font-black uppercase truncate">{u.username || u.fullName}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="bg-gray-50 p-2 border-t border-gray-200 flex justify-between items-center">
            <button onClick={() => onChange([])} className="text-[10px] font-black text-red-500 uppercase hover:underline">Clear All</button>
            <button onClick={() => setIsOpen(false)} className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded uppercase shadow hover:bg-blue-700">Done</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function BranchPhysicalStock() {
  const { currentBranch, user } = useBranch();

  const [productGroups, setProductGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchUsers, setBranchUsers] = useState([]);
  const [nextId, setNextId] = useState("SJ001");
  const [rows, setRows] = useState([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [expandedMobileRows, setExpandedMobileRows] = useState({});
  const [mobileViewMode, setMobileViewMode] = useState("CARD"); // "CARD" or "TABLE"
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const dropRef = useRef(null);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const isFieldVisible = (fieldId) => {
    if (!user) return false;
    // Allow everything by default, only hide if explicitly set to false in Control System
    const key = `physical-stock-entry_${fieldId}`;
    if (user.fieldPermissions?.[key] === false) return false;
    return true;
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return <FaSort className="inline ml-1 opacity-20" size={8} />;
    return sortConfig.direction === "asc"
      ? <FaSortUp className="inline ml-1 text-blue-500" size={8} />
      : <FaSortDown className="inline ml-1 text-blue-500" size={8} />;
  };

  useEffect(() => {
    if (currentBranch?._id) {
      fetchMeta();
      fetchNextId();
    }
  }, [currentBranch?._id]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!productSearch || productSearch.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetchWithAuth(`${API_BASE}/products?branchId=${currentBranch?._id}&search=${productSearch}&limit=50`);
        const data = await res.json();
        if (data.success) setSearchResults(data.data);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [productSearch, currentBranch?._id]);

  const fetchNextId = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/physical-stock/next-id?branchId=${currentBranch._id}`);
      const data = await res.json();
      if (data.success) setNextId(data.nextId);
    } catch {}
  };

  const fetchMeta = async () => {
    try {
      const [grRes, userRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/product-groups?branchId=${currentBranch._id}`),
        fetchWithAuth(`${API_BASE}/branch-users/branch/${currentBranch._id}`)
      ]);
      const grData = await grRes.json();
      const uData = await userRes.json();
      
      if (Array.isArray(grData)) setProductGroups(grData);
      else if (grData.success) setProductGroups(grData.data || []);

      if (uData.success) setBranchUsers(uData.data || []);
      else if (Array.isArray(uData)) setBranchUsers(uData);
    } catch {}
  };

  const searchProducts = useCallback(async (query, groupId) => {
    if (!currentBranch?._id) return;
    try {
      const url = `${API_BASE}/products?branchId=${currentBranch._id}&search=${query}&limit=500${groupId && groupId !== "ALL" ? `&productGroup=${groupId}` : ""}`;
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (data.success) setProducts(data.data || []);
    } catch {}
  }, [currentBranch?._id]);

  useEffect(() => {
    const t = setTimeout(() => {
      // Fetch even if search is empty to show initial list
      searchProducts(productSearch, groupFilter);
      if (productSearch.length >= 0) {
        setShowProductDrop(true);
      }
    }, 50);
    return () => clearTimeout(t);
  }, [productSearch, groupFilter]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropRef.current && !dropRef.current.contains(event.target)) {
        setShowProductDrop(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addRow = async (product) => {
    if (rows.find(r => r.productId === product._id)) return;
    
    // Check if a record exists for today
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const recUrl = `${API_BASE}/physical-stock?branchId=${currentBranch._id}&productId=${product._id}&fromDate=${todayStr}&toDate=${todayStr}&limit=1`;
      const recRes = await fetchWithAuth(recUrl);
      const recData = await recRes.json();
      
      if (recData.success && recData.data?.length > 0) {
        const record = recData.data[0];
        const existingRow = {
          rowId: record._id,
          productId: product._id,
          productName: product.name,
          productGroupId: product.productGroup?._id || product.productGroup,
          productGroupName: typeof product.productGroup === 'object' ? product.productGroup?.name : "",
          systemQty: record.systemQty || 0,
          damagedQty: record.damagedQty || 0,
          expiredQty: record.expiredQty || 0,
          physicalQty: record.noAction ? "NO_ACTION" : record.physicalQty,
          mrp: record.mrp || 0,
          batch: record.batch || "",
          expiryDate: record.expiryDate ? new Date(record.expiryDate).toISOString().split('T')[0] : "",
          checkedBy: record.checkedBy || [],
          status: record.status || "PENDING",
          savedId: record._id,
          saving: false
        };
        setRows(prev => [...prev, existingRow]);
      } else {
        const newRow = {
          rowId: Date.now() + Math.random(),
          productId: product._id,
          productName: product.name,
          productGroupId: product.productGroup?._id || product.productGroup,
          productGroupName: typeof product.productGroup === 'object' ? product.productGroup?.name : "",
          systemQty: product.availableQty || 0,
          damagedQty: "",
          expiredQty: "",
          physicalQty: "",
          mrp: product.mrp || 0,
          batch: product.batch || "",
          expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : "",
          checkedBy: [],
          status: "DRAFT",
          saving: false
        };
        setRows(prev => [...prev, newRow]);
      }
    } catch {
      // Fallback to new row if fetch fails
      const newRow = {
        rowId: Date.now() + Math.random(),
        productId: product._id,
        productName: product.name,
        productGroupId: product.productGroup?._id || product.productGroup,
        productGroupName: typeof product.productGroup === 'object' ? product.productGroup?.name : "",
        systemQty: product.availableQty || 0,
        damagedQty: "",
        expiredQty: "",
        physicalQty: "",
        mrp: product.mrp || 0,
        batch: product.batch || "",
        expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : "",
        checkedBy: [],
        status: "DRAFT",
        saving: false
      };
      setRows(prev => [...prev, newRow]);
    }
    
    setShowProductDrop(false);
    setProductSearch("");
  };

  const addAllFromGroup = async (groupId) => {
    if (!groupId || groupId === "ALL") {
      setRows([]); 
      return;
    }
    try {
      // 1. Fetch Products in this group
      const prodUrl = `${API_BASE}/products?branchId=${currentBranch._id}&productGroup=${groupId}&limit=500`;
      const prodRes = await fetchWithAuth(prodUrl);
      const prodData = await prodRes.json();
      
      // 2. Fetch today's physical stock records for this group
      const todayStr = new Date().toISOString().split('T')[0];
      const recUrl = `${API_BASE}/physical-stock?branchId=${currentBranch._id}&productGroupId=${groupId}&fromDate=${todayStr}&toDate=${todayStr}&limit=500`;
      const recRes = await fetchWithAuth(recUrl);
      const recData = await recRes.json();
      
      const existingRecords = recData.success ? recData.data : [];

      if (prodData.success && prodData.data) {
        const productsToAdd = prodData.data;
        const newRows = productsToAdd.map(p => {
          // Check if we already have a record for this product today
          const record = existingRecords.find(r => r.productId === p._id);
          
          if (record) {
            return {
              rowId: record._id,
              productId: p._id,
              productName: p.name,
              productGroupId: p.productGroup?._id || p.productGroup,
              productGroupName: typeof p.productGroup === 'object' ? p.productGroup?.name : "",
              systemQty: record.systemQty || 0,
              damagedQty: record.damagedQty || 0,
              expiredQty: record.expiredQty || 0,
              physicalQty: record.noAction ? "NO_ACTION" : record.physicalQty,
              mrp: record.mrp || 0,
              batch: record.batch || "",
              expiryDate: record.expiryDate ? new Date(record.expiryDate).toISOString().split('T')[0] : "",
              checkedBy: record.checkedBy || [],
              status: record.status || "PENDING",
              savedId: record._id,
              saving: false
            };
          }

          return {
            rowId: Math.random() + Date.now(),
            productId: p._id,
            productName: p.name,
            productGroupId: p.productGroup?._id || p.productGroup,
            productGroupName: typeof p.productGroup === 'object' ? p.productGroup?.name : "",
            systemQty: p.availableQty || 0,
            damagedQty: "",
            expiredQty: "",
            physicalQty: "",
            mrp: p.mrp || 0,
            batch: p.batch || "",
            expiryDate: p.expiryDate ? new Date(p.expiryDate).toISOString().split('T')[0] : "",
            checkedBy: [],
            status: "DRAFT",
            saving: false
          };
        });
        setRows(newRows);
        toast.info(`Loaded ${productsToAdd.length} items (${existingRecords.length} saved)`);
      }
    } catch (err) {
      toast.error("Failed to load group products");
    }
  };

  const updateRow = (rowId, field, value) => {
    setRows(prev => prev.map(r => r.rowId !== rowId ? r : { ...r, [field]: value }));
  };

  const calc = (row) => {
    if (row.physicalQty === "" || row.physicalQty === null || row.physicalQty === "NO_ACTION") return { inward: 0, outward: 0 };
    const p = Number(row.physicalQty) || 0;
    const s = Number(row.systemQty) || 0;
    return {
      inward: p > s ? Number((p - s).toFixed(4)) : 0,
      outward: s > p ? Number((s - p).toFixed(4)) : 0
    };
  };

  const saveRow = async (row) => {
    const isNoAction = row.physicalQty === "NO_ACTION";
    const systemIsZero = Number(row.systemQty) === 0;
    const physicalIsZero = Number(row.physicalQty) === 0;
    const systemIsNegative = Number(row.systemQty) < 0;
    const skipMandatory = isNoAction || systemIsZero || physicalIsZero || systemIsNegative;

    if (row.physicalQty === "" || row.physicalQty === null) return toast.warning("Physical Qty is mandatory");
    
    if (!skipMandatory) {
      if (!row.mrp || Number(row.mrp) <= 0) return toast.warning("Valid MRP is mandatory");
      if (!row.batch || row.batch.trim() === "") return toast.warning("Batch Number is mandatory");
      if (!row.expiryDate) return toast.warning("Expiry Date is mandatory");
    }
    
    
    setRows(prev => prev.map(r => r.rowId === row.rowId ? { ...r, saving: true } : r));
    try {
      const isNoAction = row.physicalQty === "NO_ACTION";
      const systemIsZero = Number(row.systemQty) === 0;
      const physicalIsZero = Number(row.physicalQty) === 0;
      const systemIsNegative = Number(row.systemQty) < 0;
      const skipMandatory = isNoAction || systemIsZero || physicalIsZero || systemIsNegative;

      const payload = {
        branchId: currentBranch._id,
        productGroupId: row.productGroupId || undefined,
        productGroupName: row.productGroupName || "",
        productId: row.productId,
        productName: row.productName,
        systemQty: Number(row.systemQty),
        damagedQty: Number(row.damagedQty) || 0,
        expiredQty: Number(row.expiredQty) || 0,
        physicalQty: isNoAction ? Number(row.systemQty) : (Number(row.physicalQty) || 0),
        mrp: Number(row.mrp) || 0,
        batch: skipMandatory ? (isNoAction ? "NO_ACTION" : "ZERO_STOCK") : (row.batch || ""),
        expiryDate: skipMandatory ? undefined : (row.expiryDate || undefined),
        noAction: isNoAction,
        checkedBy: row.checkedBy,
        userId: user?._id || user?.id,
        username: user?.username || user?.fullName || "Staff"
      };

      let res, data;
      if (row.savedId) {
        res = await fetchWithAuth(`${API_BASE}/physical-stock/${row.savedId}`, {
          method: "PUT", body: JSON.stringify(payload)
        });
      } else {
        res = await fetchWithAuth(`${API_BASE}/physical-stock`, {
          method: "POST", body: JSON.stringify(payload)
        });
      }
      data = await res.json();
      if (data.success) {
        setRows(prev => prev.map(r => r.rowId === row.rowId ? {
          ...r, 
          saving: false, 
          savedId: data.data._id, 
          status: "PENDING",
          physicalQty: data.data.physicalQty
        } : r));
        if (!row.savedId) fetchNextId();
        toast.success(`Record updated: ${data.data.physicalQty}`);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast.error(err.message || "Save failed");
      setRows(prev => prev.map(r => r.rowId === row.rowId ? { ...r, saving: false } : r));
    }
  };

  const sortedRows = [...rows]
    .filter(r => {
      if (!productSearch || productSearch.trim().length === 0) return true;
      return r.productName.toLowerCase().includes(productSearch.toLowerCase());
    })
    .sort((a, b) => {
      // 1. Primary Sort: Status (Not Entered/Draft vs Saved/Pending/Approved)
      const valA = a.savedId ? 2 : 1;
      const valB = b.savedId ? 2 : 1;
      if (valA !== valB) return valA - valB;

      // 2. Secondary Sort: Manual sort from header (ONLY within the same status group)
      if (sortConfig.key) {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Numeric handling
        if (["systemQty", "damagedQty", "expiredQty", "physicalQty", "mrp"].includes(sortConfig.key)) {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      }

      // 3. Tertiary Sort for Drafts (Top): Show newest added at the very top
      if (valA === 1) return b.rowId - a.rowId;

      // 4. Default Sort for Saved (Bottom): Alphabetical
      return a.productName.localeCompare(b.productName);
    });

  const exportToExcel = () => {
    if (rows.length === 0) return toast.warning("No data to export");
    const monthName = new Date(entryDate).toLocaleDateString('en-GB');
    const groupName = groupFilter && productGroups.find(g => g._id === groupFilter)?.name || "ALL GROUPS";
    
    const worksheetData = [
      [`STOCK JOURNAL ENTRY - ${monthName}`],
      [`GROUP: ${groupName.toUpperCase()}`],
      [""],
      ["PRODUCT NAME", "SYSTEM STOCK", "DAMAGE", "EXPIRED", "PHYSICAL QTY", "MRP", "BATCH", "EXPIRY DATE", "STAFF CHECKING"]
    ];

    sortedRows.forEach(r => {
      worksheetData.push([
        r.productName,
        r.systemQty,
        r.damagedQty || 0,
        r.expiredQty || 0,
        r.physicalQty === "NO_ACTION" ? "NO ACTION" : r.physicalQty,
        Number(r.mrp) === 0 ? "" : r.mrp,
        r.batch === "NO_ACTION" ? "NO ACTION" : (r.batch || ""),
        r.expiryDate || "",
        r.checkedBy.map(u => u.username || u.fullName).join(", ")
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }];
    XLSX.utils.book_append_sheet(wb, ws, "Stock Journal");
    XLSX.writeFile(wb, `Stock_Journal_${monthName.replace(/\//g, "-")}.xlsx`);
    toast.success("Excel exported successfully");
  };

  const handlePrint = () => {
    if (rows.length === 0) return toast.warning("No data to print");
    const dateStr = new Date(entryDate).toLocaleDateString('en-GB');
    const groupName = groupFilter && productGroups.find(g => g._id === groupFilter)?.name || "ALL GROUPS";
    
    const printWindow = window.open('', '_blank');
    const html = `
      <html>
        <head>
          <title>Stock Journal Print</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h1 { text-align: center; font-size: 16px; text-transform: uppercase; margin: 0; }
            .meta { text-align: center; font-size: 12px; margin-bottom: 20px; color: #555; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background-color: #f9f9f9; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <h1>Stock Journal Entry</h1>
          <div class="meta">Date: ${dateStr} | Branch: ${currentBranch?.name} | Group: ${groupName.toUpperCase()}</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25%">Product</th>
                <th style="width: 8%">System</th>
                <th style="width: 8%">Damage</th>
                <th style="width: 8%">Expired</th>
                <th style="width: 8%">Phys</th>
                <th style="width: 8%">MRP</th>
                <th style="width: 12%">Batch</th>
                <th style="width: 12%">Expiry</th>
                <th style="width: 17%">Staff</th>
              </tr>
            </thead>
            <tbody>
              ${sortedRows.map(r => `<tr>
                <td>${r.productName}</td>
                <td style="text-align: center">${r.systemQty}</td>
                <td style="text-align: center">${r.damagedQty || 0}</td>
                <td style="text-align: center">${r.expiredQty || 0}</td>
                <td style="text-align: center">${r.physicalQty === "NO_ACTION" ? "N/A" : r.physicalQty}</td>
                <td style="text-align: center">${Number(r.mrp) === 0 ? "" : r.mrp}</td>
                <td>${r.batch === "NO_ACTION" ? "N/A" : (r.batch || "")}</td>
                <td>${r.expiryDate || ""}</td>
                <td>${r.checkedBy.map(u => u.username || u.fullName).join(", ")}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 40px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; font-size: 11px; font-weight: bold;">
            <div>1. STAFF SIGN: _______________________</div>
            <div>2. STAFF SIGN: _______________________</div>
            <div>3. STAFF SIGN: _______________________</div>
            <div>4. STAFF SIGN: _______________________</div>
          </div>
          
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const savedCount = rows.filter(r => r.savedId).length;
  const draftCount = rows.filter(r => !r.savedId).length;

  return (
    <div className="min-h-screen bg-gray-50 pt-16 md:pl-20">
      <div className="p-4">
        
        <div className="bg-white border border-gray-300 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#001f3f] flex items-center justify-center rounded-xl shadow-inner">
              <FaBoxes className="text-white text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-black text-gray-800 uppercase tracking-tight leading-tight">Stock Journal Entry</h1>
                <div className="flex gap-1.5 ml-2">
                  <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 shadow-sm border border-green-200">
                    <FaCheck size={8} /> Saved: {savedCount}
                  </span>
                  <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 shadow-sm border border-orange-200">
                    Pending: {draftCount}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">
                Next: <span className="text-blue-600">{nextId}</span> - {currentBranch?.name}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:flex items-center gap-2">
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
              className="border border-gray-300 px-3 py-2 text-[11px] font-black rounded-xl outline-none bg-gray-50 text-gray-700 w-full" />
            <a href="/branch/physical-stock-records"
              className="px-3 py-2 bg-gray-800 text-white text-[11px] font-black rounded-xl hover:bg-gray-900 transition uppercase flex items-center justify-center gap-2 w-full shadow-lg shadow-gray-200">
              <FaHistory /> Records
            </a>
          </div>
        </div>

        {/* COMPACT SEARCH */}
        <div className="bg-white border border-gray-300 p-3 mb-4 flex flex-col md:flex-row gap-3 items-center rounded-xl shadow-sm relative" ref={dropRef}>
          <div className="w-full md:w-64 relative">
            <select className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[11px] font-black text-gray-700 outline-none w-full appearance-none pr-8"
              value={groupFilter} onChange={e => { 
                const val = e.target.value;
                setGroupFilter(val); 
                setProductSearch("");
                if (val && val !== "ALL") addAllFromGroup(val);
              }}>
              <option value="ALL">ALL GROUPS {products.length > 0 && `(${products.length})`}</option>
              {productGroups.map(g => <option key={g._id} value={g._id}>{g.name.toUpperCase()}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <FaBoxes size={10} />
            </div>
          </div>
          <div className="flex-1 relative w-full">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
            <input type="text" placeholder="TYPE PRODUCT NAME TO SEARCH..."
              value={productSearch} 
              onChange={e => setProductSearch(e.target.value)}
              onFocus={() => setShowProductDrop(true)}
              className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-[11px] font-black uppercase outline-none focus:border-blue-400 bg-gray-50" />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {showProductDrop && productSearch.trim().length >= 2 && (
              <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-white border border-gray-300 shadow-2xl rounded-xl overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
                {searchResults.length === 0 && !isSearching ? (
                  <div className="p-8 text-center text-[10px] font-black text-gray-300 uppercase tracking-widest">No products found matching "{productSearch}"</div>
                ) : (
                  searchResults.map(p => (
                    <div key={p._id} onClick={() => addRow(p)}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center group transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-black text-gray-800 uppercase group-hover:text-blue-600 transition-colors">{p.name}</p>
                          <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">MRP: {p.mrp || 0}</span>
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{p.productGroup?.name || "No Group"}</p>
                      </div>
                      <FaPlus className="text-gray-300 group-hover:text-blue-500 transition-all" size={12} />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ACTION TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white p-3 border border-gray-300 rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Quick Actions:</span>
            <button onClick={exportToExcel}
              className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-100">
              <FaDownload size={10} /> Export Excel
            </button>
            <button onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
              <FaPrint size={10} /> Print Report
            </button>
          </div>
          
          <button onClick={() => setRows([])}
            className="px-4 py-2 bg-rose-50 text-rose-600 text-[10px] font-black uppercase rounded-lg hover:bg-rose-100 transition border border-rose-100 flex items-center justify-center gap-2">
            <FaTrash size={10} /> Clear List
          </button>
        </div>

        <div className="space-y-4">
          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-white border border-gray-300 shadow-sm overflow-visible rounded-xl">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">#</th>
                    {isFieldVisible("productName") && <th onClick={() => handleSort("productName")} className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100">Product <SortIcon col="productName" /></th>}
                    {isFieldVisible("productGroupName") && <th onClick={() => handleSort("productGroupName")} className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100">Group <SortIcon col="productGroupName" /></th>}
                    {isFieldVisible("systemQty") && <th onClick={() => handleSort("systemQty")} className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100">System <SortIcon col="systemQty" /></th>}
                    {isFieldVisible("damagedQty") && <th onClick={() => handleSort("damagedQty")} className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100">Damage <SortIcon col="damagedQty" /></th>}
                    {isFieldVisible("expiredQty") && <th onClick={() => handleSort("expiredQty")} className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100">Expired <SortIcon col="expiredQty" /></th>}
                    {isFieldVisible("physicalQty") && <th onClick={() => handleSort("physicalQty")} className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100">Physical <SortIcon col="physicalQty" /></th>}
                    {isFieldVisible("inward") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Inward</th>}
                    {isFieldVisible("outward") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Outward</th>}
                    {isFieldVisible("mrp") && <th onClick={() => handleSort("mrp")} className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100">MRP <SortIcon col="mrp" /></th>}
                    {isFieldVisible("batch") && <th onClick={() => handleSort("batch")} className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100">Batch <SortIcon col="batch" /></th>}
                    {isFieldVisible("expiryDate") && <th onClick={() => handleSort("expiryDate")} className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100">Expiry <SortIcon col="expiryDate" /></th>}
                    {isFieldVisible("checkedBy") && <th className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Staff</th>}
                    {isFieldVisible("status") && <th onClick={() => handleSort("status")} className="px-1.5 py-4 border-r border-gray-200 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap cursor-pointer hover:bg-gray-100">Status <SortIcon col="status" /></th>}
                    <th className="px-1.5 py-4 font-black text-[9px] uppercase tracking-widest text-gray-400 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="py-20 text-center text-gray-300 font-black uppercase text-[11px] tracking-widest">
                        Search and add products to start
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row, idx) => {
                      const { inward, outward } = calc(row);
                      const isSaved = !!row.savedId;
                      return (
                        <tr key={row.rowId} className={`hover:bg-gray-50 transition-colors ${row.status === "APPROVED" ? "bg-green-50" : isSaved ? "bg-emerald-50/50" : "bg-rose-50"}`}>
                          <td className="px-1.5 py-3 border-r border-gray-100 font-black text-gray-300 text-center">{idx + 1}</td>
                          {isFieldVisible("productName") && (
                            <td className="px-1.5 py-3 border-r border-gray-100 min-w-[250px]">
                              <p className="font-black text-gray-700 text-[10px] uppercase truncate max-w-[400px]">{row.productName}</p>
                            </td>
                          )}
                          {isFieldVisible("productGroupName") && <td className="px-1.5 py-3 border-r border-gray-100 text-[9px] text-gray-400 font-black uppercase">{row.productGroupName || "-"}</td>}
                          {isFieldVisible("systemQty") && <td className="px-1.5 py-3 border-r border-gray-100 text-center font-black text-[10px] text-blue-500">{row.systemQty}</td>}
                          {isFieldVisible("damagedQty") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                                <input type="number" 
                                  value={row.damagedQty} 
                                  onChange={e => updateRow(row.rowId, "damagedQty", e.target.value)}
                                  disabled={row.status === "APPROVED"}
                                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-black outline-none focus:border-blue-400 disabled:bg-gray-50 shadow-sm text-rose-500" 
                                  placeholder="0" />
                            </td>
                          )}
                          {isFieldVisible("expiredQty") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                                <input type="number" 
                                  value={row.expiredQty} 
                                  onChange={e => updateRow(row.rowId, "expiredQty", e.target.value)}
                                  disabled={row.status === "APPROVED"}
                                  className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-black outline-none focus:border-blue-400 disabled:bg-gray-50 shadow-sm text-orange-500" 
                                  placeholder="0" />
                            </td>
                          )}
                          {isFieldVisible("physicalQty") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <div className="relative group/edit">
                                <input type={row.physicalQty === "NO_ACTION" ? "text" : "number"} 
                                  value={row.physicalQty === "NO_ACTION" ? "NO ACTION" : row.physicalQty} 
                                  onChange={e => updateRow(row.rowId, "physicalQty", e.target.value)}
                                  disabled={row.status === "APPROVED"}
                                  className={`w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-black outline-none focus:border-blue-400 disabled:bg-gray-50 shadow-sm ${row.physicalQty === "NO_ACTION" ? "bg-gray-100 text-gray-400" : ""}`} 
                                  placeholder="Qty" />
                                <select 
                                  className="absolute right-0 top-0 opacity-0 w-6 h-full cursor-pointer"
                                  onChange={e => {
                                    if (e.target.value === "NO_ACTION") updateRow(row.rowId, "physicalQty", "NO_ACTION");
                                    else updateRow(row.rowId, "physicalQty", "");
                                  }}
                                  disabled={row.status === "APPROVED"}
                                >
                                  <option value="">Edit</option>
                                  <option value="NO_ACTION">No action</option>
                                </select>
                                <FaChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={8} />
                              </div>
                            </td>
                          )}
                          {isFieldVisible("inward") && (
                            <td className="px-1.5 py-3 border-r border-gray-100 text-center">
                              {inward > 0 ? <span className="text-green-600 font-black text-[10px] bg-green-50 px-1.5 py-0.5 rounded">+{inward}</span> : ""}
                            </td>
                          )}
                          {isFieldVisible("outward") && (
                            <td className="px-1.5 py-3 border-r border-gray-100 text-center">
                              {outward > 0 ? <span className="text-red-500 font-black text-[10px] bg-red-50 px-1.5 py-0.5 rounded">-{outward}</span> : ""}
                            </td>
                          )}
                          {isFieldVisible("mrp") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <input type="number" value={row.mrp}
                                onChange={e => updateRow(row.rowId, "mrp", e.target.value)}
                                disabled={row.status === "APPROVED"}
                                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-black outline-none focus:border-blue-400 disabled:bg-gray-50"
                                placeholder="MRP" />
                            </td>
                          )}
                          {isFieldVisible("batch") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <input type="text" value={row.batch}
                                onChange={e => updateRow(row.rowId, "batch", e.target.value)}
                                disabled={row.status === "APPROVED"}
                                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-black outline-none disabled:bg-gray-50"
                                placeholder="Batch" />
                            </td>
                          )}
                          {isFieldVisible("expiryDate") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <input type="date" value={row.expiryDate}
                                onChange={e => updateRow(row.rowId, "expiryDate", e.target.value)}
                                disabled={row.status === "APPROVED"}
                                className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-[9px] font-black outline-none disabled:bg-gray-50" />
                            </td>
                          )}
                          {isFieldVisible("checkedBy") && (
                            <td className="px-1.5 py-3 border-r border-gray-100">
                              <MultiUserSelect
                                users={branchUsers}
                                selected={row.checkedBy}
                                onChange={(val) => updateRow(row.rowId, "checkedBy", val)}
                                disabled={row.status === "APPROVED"}
                              />
                            </td>
                          )}
                          {isFieldVisible("status") && (
                            <td className="px-1.5 py-3 border-r border-gray-100 text-center">
                              {row.status === "APPROVED"
                                ? <span className="text-green-600 font-black text-[9px] uppercase bg-green-50 px-2 py-1 rounded-full whitespace-nowrap">Approved</span>
                                : row.savedId 
                                  ? <span className="text-blue-500 font-black text-[9px] uppercase bg-blue-50 px-2 py-1 rounded-full whitespace-nowrap">Pending</span>
                                  : <span className="text-orange-500 font-black text-[9px] uppercase bg-orange-50 px-2 py-1 rounded-full whitespace-nowrap">Draft</span>}
                            </td>
                          )}
                          <td className="px-1.5 py-3">
                            <div className="flex items-center gap-1 justify-center">
                              {row.status !== "APPROVED" && (
                                <>
                                  {isFieldVisible("action_save") && (
                                    <button onClick={() => saveRow(row)} disabled={row.saving}
                                      className="px-4 py-1.5 bg-blue-600 text-white text-[9px] font-black rounded-lg hover:bg-blue-700 disabled:opacity-50 uppercase shadow-md shadow-blue-100">
                                      {row.saving ? "..." : "Save"}
                                    </button>
                                  )}
                                </>
                              )}
                              {row.status === "APPROVED" && (
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                  <FaCheck size={12} />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE VIEW TOGGLE & CONTENT */}
          <div className="md:hidden space-y-4">
            <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <button 
                type="button"
                onClick={() => setMobileViewMode("CARD")}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mobileViewMode === "CARD" ? "bg-[#001f3f] text-white shadow-lg" : "text-gray-400 hover:bg-gray-50"}`}>
                Cards
              </button>
              <button 
                type="button"
                onClick={() => setMobileViewMode("TABLE")}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mobileViewMode === "TABLE" ? "bg-[#001f3f] text-white shadow-lg" : "text-gray-400 hover:bg-gray-50"}`}>
                Table
              </button>
            </div>

            {sortedRows.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-300 text-center">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Search products above to start</p>
              </div>
            ) : (
              <>
                {mobileViewMode === "TABLE" ? (
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[500px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            {isFieldVisible("productName") && <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r">Product</th>}
                            {isFieldVisible("systemQty") && <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r">Sys</th>}
                            {isFieldVisible("physicalQty") && <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r">Phy</th>}
                            {(isFieldVisible("inward") || isFieldVisible("outward")) && <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r">Diff</th>}
                            {isFieldVisible("mrp") && <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400 border-r">MRP</th>}
                            <th className="px-3 py-3 font-black text-[9px] uppercase tracking-widest text-gray-400"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sortedRows.map((row) => {
                            const { inward, outward } = calc(row);
                            return (
                              <React.Fragment key={row.rowId}>
                                <tr className={`hover:bg-gray-50 transition-colors ${row.status === "APPROVED" ? "bg-green-50" : ""}`}>
                                  {isFieldVisible("productName") && (
                                    <td className="px-3 py-3 border-r border-gray-100 min-w-[140px]">
                                      <p className="font-black text-gray-700 text-[10px] uppercase leading-tight truncate">{row.productName}</p>
                                      <p className="text-[8px] font-bold text-gray-400 uppercase">{row.productGroupName || "-"}</p>
                                    </td>
                                  )}
                                  {isFieldVisible("systemQty") && <td className="px-3 py-3 border-r border-gray-100 text-center font-black text-[10px] text-blue-500">{row.systemQty}</td>}
                                  {isFieldVisible("physicalQty") && (
                                    <td className="px-3 py-3 border-r border-gray-100">
                                      <div className="relative flex items-center">
                                        <input type={row.physicalQty === "NO_ACTION" ? "text" : "number"} 
                                          value={row.physicalQty === "NO_ACTION" ? "NO ACTION" : row.physicalQty} 
                                          onChange={e => updateRow(row.rowId, "physicalQty", e.target.value)}
                                          disabled={row.status === "APPROVED"}
                                          className={`w-16 border border-gray-200 rounded px-2 py-1 text-[10px] font-black outline-none focus:border-blue-400 ${row.physicalQty === "NO_ACTION" ? "bg-gray-50 text-gray-400" : ""}`} />
                                        <select className="absolute inset-0 opacity-0 cursor-pointer"
                                          onChange={e => {
                                            if (e.target.value === "NO_ACTION") updateRow(row.rowId, "physicalQty", "NO_ACTION");
                                            else updateRow(row.rowId, "physicalQty", "");
                                          }}
                                          disabled={row.status === "APPROVED"}>
                                          <option value="">QTY</option>
                                          <option value="NO_ACTION">No action</option>
                                        </select>
                                      </div>
                                    </td>
                                  )}
                                  {(isFieldVisible("inward") || isFieldVisible("outward")) && (
                                    <td className="px-3 py-3 border-r border-gray-100 text-center">
                                      {isFieldVisible("inward") && inward > 0 && <span className="text-green-600 font-black text-[9px]">+{inward}</span>}
                                      {isFieldVisible("outward") && outward > 0 && <span className="text-red-500 font-black text-[9px]">-{outward}</span>}
                                    </td>
                                  )}
                                  {isFieldVisible("mrp") && (
                                    <td className="px-3 py-3 border-r border-gray-100">
                                      <input type="number" value={row.mrp} onChange={e => updateRow(row.rowId, "mrp", e.target.value)}
                                        disabled={row.status === "APPROVED"}
                                        className="w-12 border border-gray-200 rounded px-1 py-1 text-[9px] font-black outline-none focus:border-blue-400" placeholder="MRP" />
                                    </td>
                                  )}
                                  <td className="px-3 py-3">
                                    <button 
                                      type="button"
                                      onClick={() => setExpandedMobileRows(prev => ({ ...prev, [row.rowId]: !prev[row.rowId] }))}
                                      className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg text-gray-400"
                                    >
                                      <FaChevronDown size={10} className={`transition-transform ${expandedMobileRows[row.rowId] ? "rotate-180" : ""}`} />
                                    </button>
                                  </td>
                                </tr>
                                {expandedMobileRows[row.rowId] && (
                                  <tr className="bg-gray-50">
                                    <td colSpan="6" className="px-3 py-4 border-b border-gray-200">
                                      <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-3 bg-white p-2 rounded-xl border border-gray-100">
                                          {isFieldVisible("inward") && (
                                            <div className="flex justify-between items-center px-2">
                                              <p className="text-[8px] font-black text-emerald-600 uppercase">Inward Adjust</p>
                                              <p className="text-[10px] font-black text-emerald-700">{inward > 0 ? `+${inward}` : ""}</p>
                                            </div>
                                          )}
                                          {isFieldVisible("outward") && (
                                            <div className={`flex justify-between items-center px-2 ${isFieldVisible("inward") ? "border-l border-gray-100" : ""}`}>
                                              <p className="text-[8px] font-black text-rose-600 uppercase">Outward Adjust</p>
                                              <p className="text-[10px] font-black text-rose-700">{outward > 0 ? `-${outward}` : ""}</p>
                                            </div>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          {isFieldVisible("batch") && (
                                            <div>
                                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Batch Number</p>
                                              <input type="text" value={row.batch} onChange={e => updateRow(row.rowId, "batch", e.target.value)}
                                                disabled={row.status === "APPROVED"}
                                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-black outline-none" placeholder="Batch" />
                                            </div>
                                          )}
                                          {isFieldVisible("expiryDate") && (
                                            <div>
                                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Expiry Date</p>
                                              <input type="date" value={row.expiryDate} onChange={e => updateRow(row.rowId, "expiryDate", e.target.value)}
                                                disabled={row.status === "APPROVED"}
                                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[9px] font-black outline-none" />
                                            </div>
                                          )}
                                          {isFieldVisible("checkedBy") && (
                                            <div className="col-span-2">
                                              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Staff Member</p>
                                              <MultiUserSelect users={branchUsers} selected={row.checkedBy} onChange={(val) => updateRow(row.rowId, "checkedBy", val)} disabled={row.status === "APPROVED"} />
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                          <div className="flex items-center gap-2">
                                            {isFieldVisible("status") && (
                                              row.status === "APPROVED" ? (
                                                <span className="text-[8px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase flex items-center gap-1">
                                                  <FaCheck size={8} /> Approved
                                                </span>
                                              ) : row.savedId ? (
                                                <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-full uppercase">Pending Approval</span>
                                              ) : (
                                                <span className="text-[8px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-full uppercase">Draft Mode</span>
                                              )
                                            )}
                                          </div>
                                          <div className="flex gap-2">
                                            {row.status !== "APPROVED" && (
                                              <>
                                                {isFieldVisible("action_save") && (
                                                  <button type="button" onClick={() => saveRow(row)} disabled={row.saving} className="px-4 py-1.5 bg-[#001f3f] text-white text-[10px] font-black rounded-lg uppercase shadow-lg">
                                                    {row.saving ? "..." : "Save Record"}
                                                  </button>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {sortedRows.map(row => {
                      const { inward, outward } = calc(row);
                      return (
                        <div key={row.rowId} className={`bg-white p-4 rounded-2xl shadow-sm border ${row.status === "APPROVED" ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              {isFieldVisible("productName") && (
                                <>
                                  <h4 className="font-black text-gray-800 text-[11px] uppercase leading-tight">{row.productName}</h4>
                                  <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">{row.productGroupName || "-"}</p>
                                </>
                              )}
                            </div>
                            <div className="text-right">
                              {isFieldVisible("status") && (
                                row.status === "APPROVED" ? (
                                  <span className="text-[8px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase">Approved</span>
                                ) : row.savedId ? (
                                  <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-full uppercase">Pending</span>
                                ) : (
                                  <span className="text-[8px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-full uppercase">Draft</span>
                                )
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mb-4">
                            {isFieldVisible("systemQty") && (
                              <div className="bg-blue-50 p-2 rounded-xl">
                                <p className="text-[8px] font-black text-blue-400 uppercase mb-1">System</p>
                                <p className="text-xs font-black text-blue-600">{row.systemQty}</p>
                              </div>
                            )}
                            {isFieldVisible("physicalQty") && (
                              <div className="bg-white border border-gray-200 p-2 rounded-xl relative shadow-sm focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Physical Qty</p>
                                <div className="flex items-center">
                                  <input type={row.physicalQty === "NO_ACTION" ? "text" : "number"} 
                                    value={row.physicalQty === "NO_ACTION" ? "NO ACTION" : row.physicalQty} 
                                    onChange={e => updateRow(row.rowId, "physicalQty", e.target.value)}
                                    onFocus={() => setShowProductDrop(false)}
                                    disabled={row.status === "APPROVED"}
                                    className={`w-full bg-transparent text-xs font-black outline-none ${row.physicalQty === "NO_ACTION" ? "text-gray-400" : "text-gray-800"}`} placeholder="0" />
                                  <div className="relative">
                                    <FaChevronDown className="text-gray-300 ml-1" size={8} />
                                    <select className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                      onChange={e => {
                                        if (e.target.value === "NO_ACTION") updateRow(row.rowId, "physicalQty", "NO_ACTION");
                                        else if (e.target.value === "EDIT") updateRow(row.rowId, "physicalQty", "");
                                      }}
                                      disabled={row.status === "APPROVED"}>
                                      <option value="EDIT">Edit</option>
                                      <option value="NO_ACTION">No Action</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            )}
                            {isFieldVisible("mrp") && (
                              <div className="bg-white border border-gray-200 p-2 rounded-xl shadow-sm focus-within:border-blue-400 transition-all">
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">MRP</p>
                                <input type="number" value={row.mrp} onChange={e => updateRow(row.rowId, "mrp", e.target.value)}
                                  disabled={row.status === "APPROVED"}
                                  className="w-full bg-transparent text-xs font-black text-blue-600 outline-none" placeholder="0" />
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            {isFieldVisible("inward") && (
                              <div className="bg-emerald-50 p-2 rounded-xl flex justify-between items-center">
                                <p className="text-[8px] font-black text-emerald-600 uppercase">Inward</p>
                                <p className="text-[10px] font-black text-emerald-700">{inward > 0 ? `+${inward}` : ""}</p>
                              </div>
                            )}
                            {isFieldVisible("outward") && (
                              <div className="bg-rose-50 p-2 rounded-xl flex justify-between items-center">
                                <p className="text-[8px] font-black text-rose-600 uppercase">Outward</p>
                                <p className="text-[10px] font-black text-rose-700">{outward > 0 ? `-${outward}` : ""}</p>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            {isFieldVisible("batch") && (
                              <div>
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Batch</p>
                                <input type="text" value={row.batch} onChange={e => updateRow(row.rowId, "batch", e.target.value)}
                                  disabled={row.status === "APPROVED"}
                                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-2 py-2 text-[10px] font-black outline-none focus:border-blue-400 focus:bg-white transition-all" placeholder="Batch" />
                              </div>
                            )}
                            {isFieldVisible("expiryDate") && (
                              <div>
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Expiry</p>
                                <input type="date" value={row.expiryDate} onChange={e => updateRow(row.rowId, "expiryDate", e.target.value)}
                                  disabled={row.status === "APPROVED"}
                                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-2 py-2 text-[9px] font-black outline-none focus:border-blue-400 focus:bg-white transition-all" />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
                            <div className="flex-1">
                              {isFieldVisible("checkedBy") && (
                                <MultiUserSelect users={branchUsers} selected={row.checkedBy} onChange={(val) => updateRow(row.rowId, "checkedBy", val)} disabled={row.status === "APPROVED"} />
                              )}
                            </div>
                            {row.status !== "APPROVED" && isFieldVisible("action_save") && (
                              <button type="button" onClick={() => saveRow(row)} disabled={row.saving} 
                                className="px-6 py-2.5 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase shadow-lg active:scale-95 transition-all whitespace-nowrap">
                                {row.saving ? "..." : "Save Record"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
