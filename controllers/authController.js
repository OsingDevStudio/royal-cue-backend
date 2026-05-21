import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../supabaseClient.js";

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .limit(1);

    // 🔴 DEBUG WAJIB (Bisa kamu pantau di Logs Render)
    console.log("SUPABASE ERROR:", error);
    console.log("SUPABASE DATA:", data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: `Database error: ${error.message}`,
      });
    }

    const user = data?.[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Username tidak ditemukan",
      });
    }

    // 🔐 FITUR CERDAS: Cek apakah password dicocokkan sebagai teks biasa (untuk akun demo) ATAU bcrypt hash
    let isMatch = false;
    if (password === user.password) {
      // Jika password di DB Supabase kamu ditulis mentah "kasir123" / "admin123"
      isMatch = true;
    } else {
      try {
        // Jika password di DB berupa hash brypt ($2a$10$...)
        isMatch = await bcrypt.compare(password, user.password);
      } catch (bcryptErr) {
        isMatch = false;
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Password yang Anda masukkan salah",
      });
    }

    // Pembuatan Token JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET || "royalcue_secret", // Mengamankan jika env belum terbaca
      { expiresIn: "1d" }
    );

    return res.json({
      success: true,
      token,
      role: user.role,
      username: user.username,
    });

  } catch (err) {
    console.error("LOGIN EXCEPTION ERROR:", err);

    return res.status(500).json({
      success: false,
      message: `Server mengalami gangguan internal: ${err.message}`,
    });
  }
};