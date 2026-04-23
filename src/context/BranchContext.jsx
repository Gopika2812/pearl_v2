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
  const [reminderTokens, setReminderTokens] = useState([]);
  const [isCheckingTokens, setIsCheckingTokens] = useState(false);

  // currentBranch: superAdminViewBranch > adminViewBranch > real login branch
  const currentBranch = superAdminViewBranch || adminViewBranch || loginBranch;

  // Load from localStorage on mount
  useEffect(() => {
    const storedBranch = localStorage.getItem("currentBranch");
    const storedAdminView = localStorage.getItem("adminViewBranch");
    const storedSuperAdminView = localStorage.getItem("superAdminViewBranch");
    const storedUser = localStorage.getItem("user");

    if (storedBranch) {
      setLoginBranch(JSON.parse(storedBranch));
    }
    if (storedAdminView) {
      setAdminViewBranch(JSON.parse(storedAdminView));
    }
    if (storedSuperAdminView) {
      setSuperAdminViewBranch(JSON.parse(storedSuperAdminView));
    }
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      refreshUser(parsedUser.id || parsedUser._id, parsedUser.role);
    }
    
    setBranchLoaded(true);
  }, []);

  // Save admin view overrides to localStorage when they change
  useEffect(() => {
    if (adminViewBranch) {
      localStorage.setItem("adminViewBranch", JSON.stringify(adminViewBranch));
    } else {
      localStorage.removeItem("adminViewBranch");
    }
  }, [adminViewBranch]);

  useEffect(() => {
    if (superAdminViewBranch) {
      localStorage.setItem("superAdminViewBranch", JSON.stringify(superAdminViewBranch));
    } else {
      localStorage.removeItem("superAdminViewBranch");
    }
  }, [superAdminViewBranch]);

  const refreshBlockingTokens = async () => {
    const myId = user?.id || user?._id;
    const branchId = currentBranch?._id || currentBranch?.id;

    if (!myId || !branchId) {
      setBlockingTokens([]);
      setReminderTokens([]);
      return;
    }

    try {
      setIsCheckingTokens(true);
      // Fetch all tokens for this branch (no status filter to get all active ones)
      const res = await fetchWithAuth(`${API_BASE}/tokens/branch/${branchId}`);
      const data = await res.json();
      
      if (data.success) {
        const now = new Date();
        const blockTimeMinutes = currentBranch?.tokenBlockTime || 120;
        const blockTimeMs = blockTimeMinutes * 60 * 1000;

        const blocks = [];
        const reminders = [];

        data.data.forEach(t => {
          const assigneeId = t.assignedTo?.id?._id || t.assignedTo?.id;
          if (assigneeId?.toString() !== myId?.toString()) return;

          // 1. OPEN -> Instant Hard Block
          if (t.status === "OPEN") {
            blocks.push({ ...t, blockType: "ACKNOWLEDGE" });
          }
          // 2. TAKEN but NOT STARTED for > 2 hours -> Hard Block
          else if (t.status === "TAKEN") {
            const takenTime = new Date(t.takenAt);
            if (now - takenTime > blockTimeMs) {
              blocks.push({ ...t, blockType: "START_WORK" });
            }
          }
          // 3. IN_PROGRESS but NOT COMPLETED for > 2 hours -> Soft Reminder
          else if (t.status === "IN_PROGRESS") {
            const progressTime = new Date(t.inProgressAt || t.takenAt);
            if (now - progressTime > blockTimeMs) {
              reminders.push({ ...t, reminderType: "COMPLETE_TASK" });
            }
          }
        });

        setBlockingTokens(blocks);
        setReminderTokens(reminders);
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
    localStorage.removeItem("adminViewBranch");
    localStorage.removeItem("superAdminViewBranch");
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
        reminderTokens,
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
