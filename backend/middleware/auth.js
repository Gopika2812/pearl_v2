import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
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

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Set user data on request
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
