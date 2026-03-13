import jwt from "jsonwebtoken";

export const authenticate = (req, res, next) => {
  try {
    let token = null;

    // 1️⃣ Check cookie
    if (req.cookies?.token) {
      token = req.cookies.token;
    }

    // 2️⃣ Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    if (!process.env.TOKEN_SECRET) {
      console.error("TOKEN_SECRET not configured");
      return res.status(500).json({
        success: false,
        error: "Server configuration error"
      });
    }

    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
    req.user = decoded;

    next();

  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token"
    });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        error: "Access denied"
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Required role: ${roles.join(", ")}`
      });
    }

    next();
  };
};