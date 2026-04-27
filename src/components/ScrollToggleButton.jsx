import React, { useState, useEffect } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

/**
 * A floating button that toggles between scroll-to-bottom and scroll-to-top.
 * Shows ↓ when near the top, ↑ when scrolled down.
 */
const ScrollToggleButton = () => {
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      // Consider "at bottom" when within 200px of the bottom
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 200);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClick = () => {
    if (isAtBottom) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 w-11 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-200 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
      style={{ 
        animation: 'scrollBtnPulse 2s ease-in-out infinite',
      }}
      title={isAtBottom ? "Scroll to top" : "Scroll to bottom"}
    >
      <style>{`
        @keyframes scrollBtnPulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3); }
          50% { box-shadow: 0 4px 20px rgba(79, 70, 229, 0.5); }
        }
      `}</style>
      {isAtBottom ? (
        <FaChevronUp size={16} className="transition-transform duration-300" />
      ) : (
        <FaChevronDown size={16} className="transition-transform duration-300 animate-bounce" />
      )}
    </button>
  );
};

export default ScrollToggleButton;
