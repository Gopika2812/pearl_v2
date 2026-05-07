import React, { useState, useEffect } from 'react';
import { 
    FaPlus, FaSearch, FaFilter, FaCalendarAlt, 
    FaUser, FaEllipsisV, FaCheckCircle, FaExclamationCircle,
    FaTrash, FaClock
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { apiWithAuth } from '../../api';
import { useBranch } from '../../context/BranchContext';

const COLUMNS = [
    { id: 'TODO', title: 'To Do', color: 'bg-slate-100 text-slate-600' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-indigo-50 text-indigo-600' },
    { id: 'REVIEW', title: 'Under Review', color: 'bg-amber-50 text-amber-600' },
    { id: 'DONE', title: 'Completed', color: 'bg-emerald-50 text-emerald-600' }
];

const TaskBoardPage = () => {
    const { currentBranch, user } = useBranch();
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    
    // New Task Form State
    const [newTask, setNewTask] = useState({
        title: "",
        description: "",
        assignedTo: "",
        priority: "MEDIUM",
        dueDate: ""
    });

    useEffect(() => {
        if (currentBranch) {
            fetchTasks();
        }
    }, [currentBranch]);

    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const res = await apiWithAuth.get(`/crm-orders/tasks?branchId=${currentBranch._id}`);
            setTasks(res.data);
        } catch (error) {
            toast.error("Failed to fetch tasks");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            const res = await apiWithAuth.post('/crm-orders/tasks', {
                ...newTask,
                branchId: currentBranch._id
            });
            setTasks([res.data, ...tasks]);
            setIsNewTaskModalOpen(false);
            setNewTask({ title: "", description: "", assignedTo: "", priority: "MEDIUM", dueDate: "" });
            toast.success("Task created!");
        } catch (error) {
            toast.error("Failed to create task");
        }
    };

    const handleUpdateStatus = async (taskId, newStatus) => {
        try {
            const res = await apiWithAuth.patch(`/crm-orders/tasks/${taskId}`, { status: newStatus });
            setTasks(prev => prev.map(t => t._id === taskId ? res.data : t));
        } catch (error) {
            toast.error("Failed to update task");
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Delete this task?")) return;
        try {
            await apiWithAuth.delete(`/crm-orders/tasks/${taskId}`);
            setTasks(prev => prev.filter(t => t._id !== taskId));
            toast.success("Task deleted");
        } catch (error) {
            toast.error("Failed to delete task");
        }
    };

    const filteredTasks = tasks.filter(t => 
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderTaskCard = (task) => (
        <div 
            key={task._id}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative mb-4"
        >
            <div className="flex justify-between items-start mb-3">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                    task.priority === 'URGENT' ? 'bg-rose-100 text-rose-600' :
                    task.priority === 'HIGH' ? 'bg-amber-100 text-amber-600' :
                    task.priority === 'MEDIUM' ? 'bg-indigo-100 text-indigo-600' :
                    'bg-slate-100 text-slate-500'
                }`}>
                    {task.priority}
                </span>
                <button 
                    onClick={() => handleDeleteTask(task._id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                >
                    <FaTrash size={12} />
                </button>
            </div>
            
            <h4 className="text-sm font-bold text-slate-800 mb-1 leading-tight">{task.title}</h4>
            <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{task.description}</p>
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center text-[10px] font-black">
                        {task.assignedTo?.substring(0, 2).toUpperCase() || <FaUser size={8} />}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{task.assignedTo || 'Unassigned'}</span>
                </div>
                {task.dueDate && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                        <FaClock size={10} />
                        {new Date(task.dueDate).toLocaleDateString()}
                    </div>
                )}
            </div>

            {/* Status Quick Actions */}
            <div className="mt-4 flex gap-1">
                {COLUMNS.filter(c => c.id !== task.status).map(col => (
                    <button 
                        key={col.id}
                        onClick={() => handleUpdateStatus(task._id, col.id)}
                        className="text-[8px] font-black uppercase tracking-tighter px-2 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded-md transition-colors"
                    >
                        Move to {col.title}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
            {/* Header */}
            <div className="max-w-[1600px] mx-auto mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                <FaCheckCircle />
                            </span>
                            Task Board <span className="text-indigo-500 font-medium text-sm bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">CRM Management</span>
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium">Assign tasks, track progress, and manage customer follow-ups.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Search tasks..."
                                className="pl-11 pr-6 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all w-64 text-sm font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={() => setIsNewTaskModalOpen(true)}
                            className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 active:scale-95"
                        >
                            <FaPlus /> New Task
                        </button>
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {COLUMNS.map(col => (
                    <div key={col.id} className="flex flex-col h-full min-h-[70vh]">
                        <div className={`p-4 rounded-2xl mb-4 flex items-center justify-between ${col.color}`}>
                            <h3 className="text-xs font-black uppercase tracking-widest">{col.title}</h3>
                            <span className="text-[10px] font-black bg-white/50 px-2 py-0.5 rounded-full">
                                {filteredTasks.filter(t => t.status === col.id).length}
                            </span>
                        </div>
                        <div className="flex-1 rounded-3xl bg-slate-50/50 p-2 overflow-y-auto no-scrollbar">
                            {filteredTasks.filter(t => t.status === col.id).map(renderTaskCard)}
                        </div>
                    </div>
                ))}
            </div>

            {/* New Task Modal */}
            {isNewTaskModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-8 bg-indigo-600 text-white">
                            <h2 className="text-2xl font-black uppercase tracking-tight">Create New Task</h2>
                            <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">Define a new objective for the team</p>
                        </div>
                        <form onSubmit={handleCreateTask} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Task Title</label>
                                <input 
                                    required
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 text-sm outline-none transition-all"
                                    placeholder="What needs to be done?"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</label>
                                <textarea 
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 text-sm outline-none transition-all"
                                    placeholder="Add more details..."
                                    rows="3"
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assign To</label>
                                    <input 
                                        className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 text-sm outline-none transition-all"
                                        placeholder="Username"
                                        value={newTask.assignedTo}
                                        onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Priority</label>
                                    <select 
                                        className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 text-sm outline-none transition-all appearance-none"
                                        value={newTask.priority}
                                        onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                                    >
                                        <option value="LOW">LOW</option>
                                        <option value="MEDIUM">MEDIUM</option>
                                        <option value="HIGH">HIGH</option>
                                        <option value="URGENT">URGENT</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Due Date</label>
                                <input 
                                    type="date"
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 text-sm outline-none transition-all"
                                    value={newTask.dueDate}
                                    onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsNewTaskModalOpen(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                                >
                                    Create Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskBoardPage;
