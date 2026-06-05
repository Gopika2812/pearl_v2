import React, { useState, useEffect, useRef } from "react";
import { FaChevronDown, FaSearch } from "react-icons/fa";

const SearchableSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select...", 
  icon: Icon,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find the selected option label to display
  const selectedOption = options.find(opt => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm(""); // Reset search when closing
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {/* Dropdown Trigger */}
      <div 
        className="w-full bg-gray-50 border border-gray-200 focus-within:border-indigo-500 rounded-lg pl-3 pr-8 py-2.5 flex items-center justify-between cursor-pointer transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xs font-bold uppercase text-gray-700 truncate select-none">
          {displayLabel}
        </span>
        {Icon ? (
          <Icon className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
        ) : (
          <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full min-w-[200px] mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {/* Search Bar */}
          <div className="p-2 border-b border-gray-100 bg-gray-50 sticky top-0">
            <div className="relative">
              <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={10} />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:border-indigo-500 transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <div
                  key={opt.value || idx}
                  className={`px-3 py-2.5 text-[11px] font-bold uppercase cursor-pointer transition-colors ${
                    String(value) === String(opt.value)
                      ? "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-2 border-transparent"
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  {opt.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-xs font-semibold text-center text-gray-400">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
