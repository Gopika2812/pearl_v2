import React, { useState, useEffect } from "react";
import { FaTrash, FaEdit, FaSave, FaTimes, FaPlus, FaCheck, FaExclamationTriangle } from "react-icons/fa";
import { API_BASE, fetchWithAuth, apiWithAuth } from "../../api";
import { toast } from "react-toastify";

const CategoryManagementModal = ({ isOpen, onClose, branchId, onUpdate }) => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [addMode, setAddMode] = useState(false);

    useEffect(() => {
        if (isOpen && branchId) {
            fetchCategories();
        }
    }, [isOpen, branchId]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE}/customer-categories?branchId=${branchId}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setCategories(data);
            } else if (data.success) {
                setCategories(data.data || []);
            }
        } catch (err) {
            console.error("Error fetching categories:", err);
            toast.error("Failed to load categories");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async (id) => {
        if (!newName.trim()) return toast.error("Name cannot be empty");
        try {
            const res = await fetchWithAuth(`${API_BASE}/customer-categories/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() })
            });
            if (res.ok) {
                toast.success("Category updated");
                setEditingId(null);
                fetchCategories();
                onUpdate();
            }
        } catch (err) {
            toast.error("Update failed");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure? This will unassign this category from all customers.")) return;
        try {
            const res = await fetchWithAuth(`${API_BASE}/customer-categories/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Category deleted");
                fetchCategories();
                onUpdate();
            }
        } catch (err) {
            toast.error("Delete failed");
        }
    };

    const handleAddNew = async () => {
        if (!newName.trim()) return toast.error("Name required");
        try {
            const res = await fetchWithAuth(`${API_BASE}/customer-categories`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), branchId })
            });
            if (res.ok) {
                toast.success("Category added");
                setAddMode(false);
                setNewName("");
                setNewDesc("");
                fetchCategories();
                onUpdate();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to add");
            }
        } catch (err) {
            toast.error("Add failed");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[999] p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 border border-gray-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-900 to-indigo-950 p-8 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                            <span className="bg-indigo-500/20 p-2 rounded-xl">🏷️</span>
                            Manage Categories
                        </h3>
                        <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60 mt-1">Super Admin Control Panel</p>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-all active:scale-95">
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 max-h-[70vh] overflow-y-auto">
                    {/* Add New Section */}
                    {!addMode ? (
                        <button 
                            onClick={() => { setAddMode(true); setNewName(""); setNewDesc(""); }}
                            className="w-full mb-6 py-4 border-2 border-dashed border-indigo-200 rounded-3xl text-indigo-600 font-black uppercase tracking-widest text-xs hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center justify-center gap-2"
                        >
                            <FaPlus /> Create New Category
                        </button>
                    ) : (
                        <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 mb-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input 
                                    placeholder="Category Name"
                                    className="w-full bg-white border-2 border-indigo-100 rounded-2xl px-6 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                />
                                <input 
                                    placeholder="Description (Optional)"
                                    className="w-full bg-white border-2 border-indigo-100 rounded-2xl px-6 py-3 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none"
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleAddNew} className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/20">Save Category</button>
                                <button onClick={() => setAddMode(false)} className="px-6 bg-white border border-indigo-100 text-gray-500 py-3 rounded-2xl font-black uppercase tracking-widest text-xs">Cancel</button>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="py-20 text-center text-gray-400 font-black uppercase tracking-widest text-xs animate-pulse">Loading Categories...</div>
                    ) : (
                        <div className="space-y-3">
                            {categories.map(cat => (
                                <div key={cat._id} className="group bg-gray-50 hover:bg-white hover:shadow-xl hover:shadow-gray-200/50 p-5 rounded-[1.8rem] border border-gray-100 transition-all duration-300">
                                    {editingId === cat._id ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <input 
                                                    className="w-full bg-white border-2 border-indigo-500 rounded-xl px-4 py-2 text-sm font-bold outline-none"
                                                    value={newName}
                                                    onChange={e => setNewName(e.target.value)}
                                                />
                                                <input 
                                                    className="w-full bg-white border-2 border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold outline-none"
                                                    value={newDesc}
                                                    onChange={e => setNewDesc(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleSaveEdit(cat._id)} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Update</button>
                                                <button onClick={() => setEditingId(null)} className="px-4 bg-gray-200 text-gray-600 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-gray-900 font-bold text-base leading-none">{cat.name}</h4>
                                                <p className="text-xs text-gray-400 font-semibold mt-1.5">{cat.description || "No description provided"}</p>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => { setEditingId(cat._id); setNewName(cat.name); setNewDesc(cat.description); }}
                                                    className="w-10 h-10 bg-white shadow-sm border border-gray-100 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-50 transition-all hover:scale-110"
                                                >
                                                    <FaEdit size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(cat._id)}
                                                    className="w-10 h-10 bg-white shadow-sm border border-gray-100 text-rose-600 rounded-xl flex items-center justify-center hover:bg-rose-50 transition-all hover:scale-110"
                                                >
                                                    <FaTrash size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {categories.length === 0 && (
                                <div className="py-20 text-center bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
                                    <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">No categories found</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Warning (Sticky) */}
                <div className="p-6 bg-rose-50 border-t border-rose-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
                        <FaExclamationTriangle size={16} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-rose-900 uppercase tracking-widest">Careful Area</p>
                        <p className="text-[9px] font-bold text-rose-600 uppercase mt-0.5">Deleting a category resets the classification for all attached customers.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryManagementModal;
