export function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    if (!req.user.role || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }

    next();

  } catch (error) {
    console.error("Admin authorization error:", error);
    return res.status(500).json({
      success: false,
      error: "Authorization failed"
    });
  }
}