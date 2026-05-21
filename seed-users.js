import bcrypt from "bcryptjs";
import { supabase } from "./supabaseClient.js";

const seed = async () => {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const kasirPassword = await bcrypt.hash("kasir123", 10);

  await supabase.from("users").insert([
    {
      username: "admin",
      password: adminPassword,
      role: "admin",
    },
    {
      username: "kasir",
      password: kasirPassword,
      role: "kasir",
    },
  ]);

  console.log("SEED DONE");
};

seed();