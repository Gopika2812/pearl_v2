import AuditLog from "../models/AuditLog.js";

/**
 * Creates an audit log entry
 * @param {Object} params
 * @param {string} params.userId - The ID of the user performing the action
 * @param {string} params.userModel - "BranchUser" or "SuperAdmin"
 * @param {string} params.username - The name of the user
 * @param {string} [params.branchId] - The branch ID
 * @param {string} params.action - The action type (e.g., "LOGIN")
 * @param {string} params.description - Human-readable description
 * @param {string} [params.targetId] - ID of the affected document
 * @param {string} [params.targetModel] - Model name of the affected document
 * @param {Object} [params.changes] - { before, after } snapshots
 */
export const createAuditLog = async ({
  userId,
  userModel = "BranchUser",
  username,
  branchId,
  action,
  description,
  targetId,
  targetModel,
  changes,
}) => {
  try {
    const log = new AuditLog({
      user: userId,
      userModel,
      username,
      branchId,
      action,
      description,
      targetId,
      targetModel,
      changes,
    });
    await log.save();
    return log;
  } catch (error) {
    console.error("❌ Failed to create audit log:", error);
    // Don't throw - logging shouldn't crash the main process
    return null;
  }
};
