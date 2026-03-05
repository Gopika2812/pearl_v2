import { createContext, useContext, useEffect, useState } from "react";

const BranchContext = createContext();

export function BranchProvider({ children }) {
  const [currentBranch, setCurrentBranch] = useState(null);
  const [user, setUser] = useState(null);
  const [branchLoaded, setBranchLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storedBranch = localStorage.getItem("currentBranch");
    const storedUser = localStorage.getItem("user");

    if (storedBranch) {
      setCurrentBranch(JSON.parse(storedBranch));
    }
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    
    // Always mark as loaded after attempting to load from localStorage
    setBranchLoaded(true);
  }, []);

  const switchBranch = (branch, userData) => {
    setCurrentBranch(branch);
    setUser(userData);
    localStorage.setItem("currentBranch", JSON.stringify(branch));
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setCurrentBranch(null);
    setUser(null);
    localStorage.removeItem("currentBranch");
    localStorage.removeItem("user");
  };

  return (
    <BranchContext.Provider
      value={{
        branch: currentBranch,
        currentBranch,
        user,
        branchLoaded,
        switchBranch,
        logout,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error("useBranch must be used within BranchProvider");
  }
  return context;
}
