import { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaSearch, FaTimes } from "react-icons/fa";

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
    <div className="relative w-full" ref={containerRef} style={{ zIndex: isOpen ? 100 : 1 }}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 bg-transparent text-left flex items-center justify-between hover:bg-slate-50/50 transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      >
        <span className={`truncate ${(selectedOption || (typeof value === 'string' && value)) ? "font-black text-slate-800" : "font-bold text-slate-400"}`}>
          {selectedOption?.name || (typeof value === 'string' ? value : "") || placeholder}
        </span>
        <FaChevronDown className={`transition-transform text-slate-300 ml-2 ${isOpen ? "rotate-180 text-emerald-500" : ""}`} size={8} />
      </button>

      {isOpen && (
        <div 
          className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
          style={{ 
            zIndex: 9999, 
            minWidth: '220px',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
          }}
        >
          {/* Search Input */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={10} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-emerald-500 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                >
                  <FaTimes size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
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
                  className={`w-full px-4 py-3 text-left text-[11px] font-bold transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between group ${
                    value === opt._id 
                      ? "bg-emerald-50 text-emerald-700" 
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{opt.name}</span>
                  {value === opt._id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest italic">
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterableSelect;
