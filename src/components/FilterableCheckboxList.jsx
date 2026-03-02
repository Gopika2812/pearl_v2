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
      <div className="border-2 border-gray-200 rounded-lg p-3 bg-white">
        {filteredOptions.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredOptions.map(opt => (
              <label
                key={opt._id}
                className="flex items-center p-2 cursor-pointer hover:bg-blue-50 rounded-lg transition duration-150"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(opt._id)}
                  onChange={() => handleToggle(opt._id)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-900">{opt.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            No options match your search
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterableCheckboxList;
