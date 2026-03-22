import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE } from "../api";

const BranchContext = createContext();

export function BranchProvider({ children }) {
  const [loginBranch, setLoginBranch] = useState(null);
  const [adminViewBranch, setAdminViewBranch] = useState(null);
  const [superAdminViewBranch, setSuperAdminViewBranch] = useState(null);
  const [user, setUser] = useState(null);
  const [branchLoaded, setBranchLoaded] = useState(false);

  // currentBranch: superAdminViewBranch > adminViewBranch > real login branch
  const currentBranch = superAdminViewBranch || adminViewBranch || loginBranch;

  // Load from localStorage on mount
  useEffect(() => {
    const storedBranch = localStorage.getItem("currentBranch");
    const storedUser = localStorage.getItem("user");

    if (storedBranch) {
      setLoginBranch(JSON.parse(storedBranch));
    }
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      refreshUser(parsedUser.id || parsedUser._id, parsedUser.role);
    }
    
    setBranchLoaded(true);
  }, []);

  const refreshUser = async (userId, role) => {
    if (!userId) return;
    const endpoint = role === "SUPER_ADMIN" ? "super-admin" : "branch-users";
    try {
      const response = await fetch(`${API_BASE}/${endpoint}/${userId}`);
      const data = await response.json();
      if (data.success) {
        // Ensure role is preserved as SUPER_ADMIN might not have it in DB field but in JWT/logic
        const updatedUser = { ...data.data, role: role || data.data.role };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        console.log(`✅ ${role || 'User'} profile synced`);
      }
    } catch (error) {
      console.error("❌ Failed to sync user profile:", error);
    }
  };

  // Used at login time - sets the real login branch
  const switchBranch = (branch, userData) => {
    setLoginBranch(branch);
    setAdminViewBranch(null); // reset any admin override
    setUser(userData);
    localStorage.setItem("currentBranch", JSON.stringify(branch));
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setLoginBranch(null);
    setAdminViewBranch(null);
    setSuperAdminViewBranch(null);
    setUser(null);
    localStorage.removeItem("currentBranch");
    localStorage.removeItem("user");
  };

  return (
    <BranchContext.Provider
      value={{
        branch: currentBranch,
        currentBranch,
        loginBranch,
        adminViewBranch,
        setAdminViewBranch,
        superAdminViewBranch,
        setSuperAdminViewBranch,
        user,
        branchLoaded,
        switchBranch,
        logout,
        refreshUser,
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
