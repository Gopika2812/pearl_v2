import React, { useState, useEffect, useRef } from 'react';
import { FaCalendarAlt, FaChevronDown } from 'react-icons/fa';

const DateRangeDropdown = ({ startDate, endDate, onDateChange, minWidth = "200px" }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [datePreset, setDatePreset] = useState("");
    const dropdownRef = useRef(null);

    // Initial local states to allow typing/selecting before applying
    const [localStartDate, setLocalStartDate] = useState(startDate);
    const [localEndDate, setLocalEndDate] = useState(endDate);

    // Sync local state when props change
    useEffect(() => {
        setLocalStartDate(startDate);
        setLocalEndDate(endDate);
    }, [startDate, endDate]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const getPresetDates = (preset) => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case "Today":
                break;
            case "Yesterday":
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case "This Week": {
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
                break;
            }
            case "Last Week": {
                const lastWeekDay = today.getDay();
                const lastWeekDiff = today.getDate() - lastWeekDay + (lastWeekDay === 0 ? -6 : 1) - 7;
                start.setDate(lastWeekDiff);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                break;
            }
            case "This Month":
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case "Last Month":
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case "This Quarter": {
                const currentMonth = today.getMonth();
                const fyStartYear = currentMonth < 3 ? today.getFullYear() - 1 : today.getFullYear();
                let qStartMonth, qEndMonth, qYear;
                if (currentMonth >= 3 && currentMonth <= 5) {
                    qStartMonth = 3; qEndMonth = 5; qYear = fyStartYear;
                } else if (currentMonth >= 6 && currentMonth <= 8) {
                    qStartMonth = 6; qEndMonth = 8; qYear = fyStartYear;
                } else if (currentMonth >= 9 && currentMonth <= 11) {
                    qStartMonth = 9; qEndMonth = 11; qYear = fyStartYear;
                } else {
                    qStartMonth = 0; qEndMonth = 2; qYear = fyStartYear + 1;
                }
                start = new Date(qYear, qStartMonth, 1);
                end = new Date(qYear, qEndMonth + 1, 0);
                break;
            }
            case "Last Quarter": {
                const currentMonth = today.getMonth();
                const fyStartYear = currentMonth < 3 ? today.getFullYear() - 1 : today.getFullYear();
                let qStartMonth, qEndMonth, qYear;
                if (currentMonth >= 3 && currentMonth <= 5) {
                    qStartMonth = 0; qEndMonth = 2; qYear = fyStartYear;
                } else if (currentMonth >= 6 && currentMonth <= 8) {
                    qStartMonth = 3; qEndMonth = 5; qYear = fyStartYear;
                } else if (currentMonth >= 9 && currentMonth <= 11) {
                    qStartMonth = 6; qEndMonth = 8; qYear = fyStartYear;
                } else {
                    qStartMonth = 9; qEndMonth = 11; qYear = fyStartYear;
                }
                start = new Date(qYear, qStartMonth, 1);
                end = new Date(qYear, qEndMonth + 1, 0);
                break;
            }
            case "Cur FY": {
                const currentMonth = today.getMonth();
                const fyStartYear = currentMonth < 3 ? today.getFullYear() - 1 : today.getFullYear();
                start = new Date(fyStartYear, 3, 1);
                end = new Date(fyStartYear + 1, 3, 0);
                break;
            }
            case "Pre FY": {
                const currentMonth = today.getMonth();
                const fyStartYear = currentMonth < 3 ? today.getFullYear() - 1 : today.getFullYear();
                start = new Date(fyStartYear - 1, 3, 1);
                end = new Date(fyStartYear, 3, 0);
                break;
            }
            default:
                return null;
        }

        // Add 5:30 offset adjustment for India Timezone reliability in formatting
        const adjustTimezone = (dateObj) => {
            const temp = new Date(dateObj);
            temp.setMinutes(temp.getMinutes() - temp.getTimezoneOffset());
            return temp.toISOString().split("T")[0];
        };

        return {
            start: adjustTimezone(start),
            end: adjustTimezone(end)
        };
    };

    const handleApply = () => {
        onDateChange(localStartDate, localEndDate);
        setIsDropdownOpen(false);
    };

    const handlePresetClick = (preset) => {
        setDatePreset(preset);
        const dates = getPresetDates(preset);
        if (dates) {
            setLocalStartDate(dates.start);
            setLocalEndDate(dates.end);
            // Auto apply when clicking a preset
            onDateChange(dates.start, dates.end);
            setIsDropdownOpen(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    return (
        <div className="relative" style={{ minWidth }} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between bg-white border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-2.5 text-xs font-bold uppercase text-gray-700 outline-none cursor-pointer transition-all shadow-sm hover:bg-gray-50"
            >
                <div className="flex items-center gap-2">
                    <FaCalendarAlt className="text-indigo-500" size={13} />
                    <span className="normal-case font-bold tracking-tight">
                        {formatDate(startDate)} - {formatDate(endDate)}
                    </span>
                </div>
                <FaChevronDown size={10} className="text-gray-400 ml-2" />
            </button>

            {isDropdownOpen && (
                <div className="absolute right-0 lg:left-0 mt-2 w-[340px] bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-4 flex gap-3 animate-fade-in">
                    {/* Presets Column */}
                    <div className="flex flex-col gap-1 border-r border-gray-100 pr-3 w-[120px] shrink-0">
                        {["Today", "Yesterday", "This Week", "Last Week", "This Month", "Last Month", "This Quarter", "Last Quarter", "Cur FY", "Pre FY"].map(preset => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => handlePresetClick(preset)}
                                className={`text-left px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                    datePreset === preset 
                                        ? "bg-indigo-50 text-indigo-700 font-extrabold" 
                                        : "text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>

                    {/* Custom Picker Column */}
                    <div className="flex-1 flex flex-col gap-3.5 justify-between">
                        <div className="flex flex-col gap-2.5">
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={localStartDate}
                                    onChange={(e) => {
                                        setDatePreset("Custom");
                                        setLocalStartDate(e.target.value);
                                    }}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={localEndDate}
                                    onChange={(e) => {
                                        setDatePreset("Custom");
                                        setLocalEndDate(e.target.value);
                                    }}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleApply}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-widest py-2 rounded-lg transition-colors shadow-md shadow-indigo-100 mt-2"
                        >
                            Apply Filter
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangeDropdown;
