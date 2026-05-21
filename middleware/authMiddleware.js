import jwt from "jsonwebtoken";

/* =========================================
   VERIFY TOKEN
========================================= */
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Token tidak ditemukan",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // simpan user ke request
    next();
  } catch (error) {
    return res.status(403).json({
      message: "Token tidak valid",
    });
  }
};

/* =========================================
   ROLE CHECK MIDDLEWARE
========================================= */
export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Akses ditolak: role tidak diizinkan",
      });
    }

    next();
  };
};