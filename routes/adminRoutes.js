import express from "express";
import { verifyToken, authorizeRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/admin-data",
  verifyToken,
  authorizeRole("admin"),
  (req, res) => {
    res.json({
      message: "Halo Admin",
      user: req.user,
    });
  }
);

export default router;