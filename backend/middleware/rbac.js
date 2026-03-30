// Role-Based Access Control Middleware
// Usage: router.post("/endpoint", auth, rbac(["ADMIN", "MANAGER"]), controller)

const rbac = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Ensure auth middleware has been called
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const userRole = req.user.role;

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${allowedRoles.join(", ")}. Your role: ${userRole}`,
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `RBAC check failed: ${error.message}`,
        error: error.message
      });
    }
  };
};

export default rbac;
