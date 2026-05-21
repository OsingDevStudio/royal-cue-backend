import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js"; 
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();

// ========================================================
// 🛡️ KONFIGURASI CORS (FIXED - Mengizinkan Vercel)
// ========================================================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://billiard-nu.vercel.app",      // ⭐ Domain Vercel Anda
  "https://billiard-nu.vercel.app",      // ⭐ Pastikan ini ada
  "https://*.vercel.app"                  // ⭐ Izinkan semua subdomain Vercel
];

// Middleware CORS yang lebih robust
app.use(cors({
  origin: function (origin, callback) {
    // Log untuk debugging (akan terlihat di log Render)
    console.log("🔍 Incoming origin:", origin);
    
    // Izinkan request tanpa origin (Postman, mobile app, dll)
    if (!origin) {
      console.log("✅ No origin (allowed)");
      return callback(null, true);
    }
    
    // Cek apakah origin ada di allowedOrigins
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log("✅ Origin allowed (exact match):", origin);
      return callback(null, true);
    }
    
    // Cek apakah origin berakhiran .vercel.app
    if (origin.endsWith('.vercel.app')) {
      console.log("✅ Origin allowed (vercel.app):", origin);
      return callback(null, true);
    }
    
    // Jika tidak ada yang cocok, blokir
    console.log("❌ CORS blocked:", origin);
    callback(new Error(`Akses ditolak oleh aturan keamanan CORS backend! Origin ${origin} tidak diizinkan`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["Content-Length", "X-Kuma-Revision"]
}));

// Handle preflight requests secara manual (tambahan untuk keamanan)
app.options('*', cors());

app.use(express.json());

// ========================================================
// 🔐 ROUTE SISTEM UTAMA (AUTH & ADMIN)
// ========================================================
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// ========================================================
// 💵 ROUTE KASIR & KONTROL MEJA BILIAR
// ========================================================

/* 1. Ambil Semua Data Reservasi untuk Monitor Kasir */
app.get("/api/kasir/reservasi", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reservasi")
      .select("*")
      .order("waktuDibuat", { ascending: false });
    
    if (error) {
      console.error("Error fetching reservations:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error in /api/kasir/reservasi:", err);
    return res.status(500).json({ success: false, message: "Gagal mengambil data dari database" });
  }
});

/* 2. Terima Pesanan Baru dari Pelanggan (Menghitung Total Otomatis) */
app.post("/api/reservasi", async (req, res) => {
  try {
    console.log("📥 Received reservation request:", req.body);
    
    const dataIncoming = req.body;
    const namaMeja = dataIncoming.nomorMeja || dataIncoming.meja || "";
    const durasi = parseInt(dataIncoming.durasiBermain || dataIncoming.durasi) || 1;
    
    // Logika Hitung Harga
    const hargaPerJam = namaMeja.toLowerCase().includes("vip") ? 80000 : 50000;
    const totalHarga = hargaPerJam * durasi;

    const dataPesanan = {
      ...dataIncoming,
      total: String(totalHarga) // Sinkronisasi dengan tipe text di DB
    };

    const { data, error } = await supabase
      .from("reservasi")
      .insert([dataPesanan])
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
    
    console.log("✅ Reservation saved successfully:", data);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("Error in /api/reservasi:", err);
    return res.status(500).json({ success: false, message: "Gagal memproses pesanan baru: " + err.message });
  }
});

/* 3. 🔥 TOMBOL START: Mengubah Status Menjadi "Playing" */
app.post("/api/kasir/start/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🎮 Starting game for reservation:", id);
    
    // Format jam menit biasa untuk kolom jamMulai ("17:30")
    const waktuJamMenit = new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    
    // Format string YYYY-MM-DD HH:MM:SS untuk PostgreSQL/Supabase
    const waktuSQL = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const { data, error } = await supabase
      .from("reservasi")
      .update({ 
        statusPemesanan: "Playing", 
        jamMulai: waktuJamMenit,        
        start_time: waktuSQL
      })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error starting game:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
    
    console.log("✅ Game started successfully");
    return res.json({ success: true, message: "Meja biliar berhasil dimulai!", data });
  } catch (err) {
    console.error("Error in /api/kasir/start/:id:", err);
    return res.status(500).json({ success: false, message: "Gagal memproses aksi Start" });
  }
});

/* 4. 🔥 TOMBOL STOP: Mengubah Status Menjadi "Selesai" */
app.post("/api/kasir/stop/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🛑 Stopping game for reservation:", id);
    
    // Format string timestamp standar SQL
    const waktuSQL = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const { data, error } = await supabase
      .from("reservasi")
      .update({ 
        statusPemesanan: "Selesai",
        end_time: waktuSQL
      })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error stopping game:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
    
    console.log("✅ Game stopped successfully");
    return res.json({ success: true, message: "Meja biliar berhasil dihentikan!", data });
  } catch (err) {
    console.error("Error in /api/kasir/stop/:id:", err);
    return res.status(500).json({ success: false, message: "Gagal memproses aksi Stop" });
  }
});

/* 5. 🔥 TOMBOL STRUK: Ambil Data Supabase & Cetak Struk */
app.post("/api/kasir/print/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🖨️ Printing receipt for reservation:", id);

    const { data: pesanan, error } = await supabase
      .from("reservasi")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !pesanan) {
      console.error("Reservation not found:", id);
      return res.status(404).json({ success: false, message: "Data billing tidak ditemukan" });
    }

    const namaMeja = pesanan.nomorMeja || "Meja 1";
    const hargaPerJam = namaMeja.toLowerCase().includes("vip") ? 80000 : 50000;
    const durasi = parseInt(pesanan.durasiBermain) || 1;
    const totalBayar = pesanan.total ? parseInt(pesanan.total) : (hargaPerJam * durasi);

    const stripLine = "====================================";
    const borderLine = "------------------------------------";

    const strukNota = `${stripLine}
         ROYAL CUE STUDIO           
${stripLine}
ID Booking : ${pesanan.id}
Pelanggan  : ${pesanan.namaPelanggan || "Pelanggan"}
Meja       : ${namaMeja}
Durasi     : ${durasi} Jam
Jam Mulai  : ${pesanan.jamMulai || "14:00"}
${borderLine}
Tarif/Jam  : Rp ${hargaPerJam.toLocaleString("id-ID")}
TOTAL      : Rp ${totalBayar.toLocaleString("id-ID")}
Status     : ${pesanan.statusPemesanan || "Selesai"}
${stripLine}
       TERIMA KASIH ATAS KUNJUNGANNYA 
${stripLine}`;

    console.log("✅ Receipt generated successfully");
    return res.json({ 
      success: true, 
      message: "Struk berhasil digenerate!", 
      data: strukNota 
    });
  } catch (err) {
    console.error("Error in /api/kasir/print/:id:", err);
    return res.status(500).json({ success: false, message: "Gagal memproses print struk" });
  }
});

// ========================================================
// 🛠️ ROUTE TEST DATABASE & RUNNING PORT
// ========================================================
app.get("/test-db", async (req, res) => {
  console.log("🔍 Testing database connection...");
  const { data, error } = await supabase.from("users").select("*");
  if (error) {
    console.error("Database test error:", error);
  } else {
    console.log("✅ Database connected, users count:", data?.length || 0);
  }
  res.json({ data, error });
});

// Root endpoint untuk cek server
app.get("/", (req, res) => {
  res.json({ 
    message: "Royal Cue Backend API is running!", 
    status: "active",
    endpoints: {
      auth: "/api/auth/login",
      reservations: "/api/reservasi",
      kasir: "/api/kasir/reservasi",
      test: "/test-db"
    }
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
  console.log(`📍 CORS enabled for:`, allowedOrigins);
  console.log(`🌐 Test URL: http://localhost:${PORT}/test-db`);
});