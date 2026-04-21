import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE, fetchWithAuth } from "../api";

const BranchContext = createContext();

export function BranchProvider({ children }) {
  const [loginBranch, setLoginBranch] = useState(null);
  const [adminViewBranch, setAdminViewBranch] = useState(null);
  const [superAdminViewBranch, setSuperAdminViewBranch] = useState(null);
  const [user, setUser] = useState(null);
  const [branchLoaded, setBranchLoaded] = useState(false);
  const [blockingTokens, setBlockingTokens] = useState([]);
  const [isCheckingTokens, setIsCheckingTokens] = useState(false);

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

  const refreshBlockingTokens = async () => {
    const myId = user?.id || user?._id;
    const branchId = currentBranch?._id || currentBranch?.id;

    if (!myId || !branchId) {
      setBlockingTokens([]);
      return;
    }

    try {
      setIsCheckingTokens(true);
      const res = await fetchWithAuth(`${API_BASE}/tokens/branch/${branchId}?status=OPEN`);
      const data = await res.json();
      
      if (data.success) {
        const assignedToMe = data.data.filter(t => {
          const assigneeId = t.assignedTo?.id?._id || t.assignedTo?.id;
          return assigneeId?.toString() === myId?.toString() && t.status === "OPEN";
        });
        setBlockingTokens(assignedToMe);
      }
    } catch (err) {
      console.error("Token check failed:", err);
    } finally {
      setIsCheckingTokens(false);
    }
  };

  // Poll for blocking tokens
  useEffect(() => {
    refreshBlockingTokens();
    const interval = setInterval(refreshBlockingTokens, 60000);
    return () => clearInterval(interval);
  }, [user?.id, user?._id, currentBranch?._id, currentBranch?.id]);

  const refreshUser = async (userId, role) => {
    if (!userId) return;
    const endpoint = role === "SUPER_ADMIN" ? "super-admin" : "branch-users";
    try {
      const response = await fetchWithAuth(`${API_BASE}/${endpoint}/${userId}`);
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

    // Sync full profile (permissions, name, etc.) immediately after login
    if (userData?._id || userData?.id) {
      refreshUser(userData._id || userData.id, userData.role);
    }
  };

  const logout = () => {
    setLoginBranch(null);
    setAdminViewBranch(null);
    setSuperAdminViewBranch(null);
    setUser(null);
    setBlockingTokens([]);
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
        blockingTokens,
        isCheckingTokens,
        refreshBlockingTokens
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
