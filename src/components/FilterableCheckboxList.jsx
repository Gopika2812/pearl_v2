import { useEffect, useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";

/**
 * FilterableCheckboxList - A searchable checkbox list component
 * @param {Array} options - Array of options with { _id, name } format
 * @param {Array} selectedIds - Array of selected IDs
 * @param {Function} onChange - Callback when selections change
 * @param {string} placeholder - Search placeholder text
 */
const FilterableCheckboxList = ({
  options = [],
  selectedIds = [],
  onChange,
  placeholder = "Search...",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options);

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

  const handleToggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selId => selId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="w-full">
      {/* Search Input */}
      <div className="mb-3">
        <div className="relative">
          <FaSearch className="absolute left-3 top-3 text-gray-400" size={14} />
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <FaTimes size={14} />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-gray-500 mt-1">
            Found {filteredOptions.length} of {options.length} items
          </p>
        )}
      </div>

      {/* Checkbox Options */}
      <div className="border-2 border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
          {filteredOptions.length > 0 ? (
            <div className="flex flex-col gap-1">
              {filteredOptions.map(opt => {
                const isSelected = selectedIds.includes(opt._id);
                return (
                  <label
                    key={opt._id}
                    className={`flex items-center p-2.5 cursor-pointer rounded-lg transition-all duration-200 ${
                      isSelected 
                        ? "bg-primary/10 border-primary/20" 
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(opt._id)}
                        className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary focus:ring-offset-0 cursor-pointer transition-all"
                      />
                    </div>
                    <span className={`ml-3 text-sm font-medium transition-colors ${
                      isSelected ? "text-primary shadow-sm" : "text-gray-600"
                    }`}>
                      {opt.name}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm flex flex-col items-center gap-2">
              <span className="text-2xl">🔍</span>
              No matches found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterableCheckboxList;
