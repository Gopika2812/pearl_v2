import { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaSearch, FaTimes } from "react-icons/fa";

/**
 * FilterableSelect - A searchable dropdown component
 * @param {Array} options - Array of options with { _id, name } format
 * @param {string} value - Currently selected value
 * @param {Function} onChange - Callback when value changes
 * @param {string} placeholder - Placeholder text
 * @param {string} className - Custom CSS classes
 */
const FilterableSelect = ({
  options = [],
  value,
  onChange,
  placeholder = "-- Select --",
  className = "",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options);
  const containerRef = useRef(null);

  // Update filtered options when search query or options change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter(opt =>
        opt.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [searchQuery, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt._id === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3.5 border border-slate-100 rounded-2xl bg-white text-left flex items-center justify-between hover:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''} ${className}`}
      >
        <span className={`text-sm ${selectedOption ? "font-black text-slate-800" : "font-bold text-slate-400"}`}>
          {selectedOption?.name || placeholder}
        </span>
        <FaChevronDown className={`transition-transform text-slate-300 ${isOpen ? "rotate-180 text-emerald-500" : ""}`} size={10} />
      </button>

      {isOpen && (
        <div className="absolute z-[999] w-full mt-2 bg-white border border-slate-100 rounded-[2rem] shadow-2xl shadow-slate-200 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <div className="relative">
              <FaSearch className="absolute left-2.5 top-2.5 text-gray-400" size={12} />
              <input
                type="text"
                placeholder="Type to filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-8 pr-8 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
                >
                  <FaTimes size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <button
                  key={opt._id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(opt._id);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-indigo-50 transition block border-b border-slate-50 last:border-0 ${
                    value === opt._id ? "bg-indigo-100 font-bold text-indigo-600" : "text-slate-600"
                  }`}
                >
                  {opt.name}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterableSelect;
