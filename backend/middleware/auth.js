import jwt from "jsonwebtoken";
import BranchUser from "../models/BranchUser.js";

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      console.warn(`🔐 Auth Failure: No token provided for ${req.originalUrl}`);
      return res.status(401).json({
        success: false,
        message: "No token, authorization denied",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Set user data on request

    // If not SUPER_ADMIN, fetch latest permissions and details from DB to keep token small
    if (decoded.role !== "SUPER_ADMIN") {
      const user = await BranchUser.findById(decoded.id).lean();
      if (user) {
        req.user.allowedPages = user.allowedPages || [];
        req.user.fieldPermissions = user.fieldPermissions || {};
        req.user.actionPermissions = user.actionPermissions || {};
        req.user.allowedVoucherTypes = user.allowedVoucherTypes || [];
        req.user.allowedBranches = user.allowedBranches || [];
        // Ensure both branch and branchId are present for route compatibility
        req.user.branch = req.user.branch || user.branch;
        req.user.branchId = req.user.branchId || user.branch;
      }
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }
    res.status(401).json({
      success: false,
      message: "Token is not valid",
    });
  }
};

export default auth;
