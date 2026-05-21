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

    // 🔥 DEBUG WAJIB
    console.log("SUPABASE ERROR:", error);
    console.log("SUPABASE DATA:", data);

    if (error) {
      return res.json({
        success: false,
        message: error.message, // 🔥 tampilkan error asli
      });
    }

    const user = data?.[0];

    if (!user) {
      return res.json({
        success: false,
        message: "Username tidak ditemukan",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({
        success: false,
        message: "Password salah",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      success: true,
      token,
      role: user.role,
      username: user.username,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};