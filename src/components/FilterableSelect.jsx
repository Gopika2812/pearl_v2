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
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 focus:outline-none focus:border-primary transition ${className}`}
      >
        <span className={selectedOption ? "text-gray-900" : "text-gray-500"}>
          {selectedOption?.name || placeholder}
        </span>
        <FaChevronDown className={`transition-transform ${isOpen ? "rotate-180" : ""}`} size={12} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg">
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
                  onClick={() => {
                    onChange(opt._id);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 transition ${
                    value === opt._id ? "bg-blue-100 font-semibold text-primary" : ""
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
