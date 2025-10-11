import jwt from "jsonwebtoken";

export const authenticate = (req, res, next) => {
  const token = req.cookies?.token;
  console.log(
    "Auth Middleware: Received token:",
    token ? "(token present)" : "(no token)"
  );
  if (!token) {
    return res.status(401).json({ error: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
    req.user = decoded;
    console.log("Auth Middleware: Token decoded successfully. User:", req.user);
    next();
  } catch (err) {
    console.error("Auth Middleware: Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res
        .status(403)
        .json({ error: "Access denied. No role provided." });
    }
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: `Access denied. Required roles: ${roles.join(", ")}` });
    }
    next();
  };
};
