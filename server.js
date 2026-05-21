import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js"; 
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();

// ========================================================
// 🛡️ KONFIGURASI CORS (LENGKAP - SUPPORT VERCEL)
// ========================================================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://billiard-nu.vercel.app",
  "https://billiard-nu.vercel.app",
  "https://*.vercel.app",
  "https://*.vercel.app"
];

// Middleware CORS yang lengkap
app.use(cors({
  origin: function (origin, callback) {
    // Log untuk debugging di Render
    console.log("🔍 [CORS] Incoming origin:", origin);
    
    // Izinkan request tanpa origin (Postman, mobile app, dll)
    if (!origin) {
      console.log("✅ [CORS] No origin (allowed for Postman/mobile)");
      return callback(null, true);
    }
    
    // Cek apakah origin ada di allowedOrigins
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log("✅ [CORS] Origin allowed (exact match):", origin);
      return callback(null, true);
    }
    
    // Cek apakah origin berakhiran .vercel.app
    if (origin.endsWith('.vercel.app')) {
      console.log("✅ [CORS] Origin allowed (vercel.app):", origin);
      return callback(null, true);
    }
    
    // Cek apakah origin adalah localhost (untuk development)
    if (origin.includes('localhost')) {
      console.log("✅ [CORS] Origin allowed (localhost):", origin);
      return callback(null, true);
    }
    
    // Jika tidak ada yang cocok, blokir
    console.log("❌ [CORS] Blocked origin:", origin);
    callback(new Error(`CORS policy: Origin ${origin} tidak diizinkan`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["Content-Length", "X-Kuma-Revision"],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle preflight requests secara eksplisit
app.options('*', (req, res) => {
  console.log("🔄 [CORS] Preflight request received for:", req.headers.origin);
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(204);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================================
// 📝 LOGGING MIDDLEWARE (Untuk debugging)
// ========================================================
app.use((req, res, next) => {
  console.log(`📨 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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
    console.log("📊 [GET] /api/kasir/reservasi - Fetching all reservations");
    
    const { data, error } = await supabase
      .from("reservasi")
      .select("*")
      .order("waktuDibuat", { ascending: false });
    
    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
    
    console.log(`✅ Found ${data?.length || 0} reservations`);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Server error in /api/kasir/reservasi:", err);
    return res.status(500).json({ success: false, message: "Gagal mengambil data dari database" });
  }
});

/* 2. Terima Pesanan Baru dari Pelanggan (Menghitung Total Otomatis) */
app.post("/api/reservasi", async (req, res) => {
  try {
    console.log("📝 [POST] /api/reservasi - New reservation request");
    console.log("📦 Request body:", JSON.stringify(req.body, null, 2));
    
    const dataIncoming = req.body;
    const namaMeja = dataIncoming.nomorMeja || dataIncoming.meja || "";
    const durasi = parseInt(dataIncoming.durasiBermain || dataIncoming.durasi) || 1;
    
    // Logika Hitung Harga
    const isVip = namaMeja.toLowerCase().includes("vip");
    const hargaPerJam = isVip ? 80000 : 50000;
    const totalHarga = hargaPerJam * durasi;
    
    console.log(`💰 Harga per jam: ${hargaPerJam}, Durasi: ${durasi} jam, Total: ${totalHarga}`);

    const dataPesanan = {
      id: dataIncoming.id || `RC-${Date.now()}`,
      namaPelanggan: dataIncoming.namaPelanggan || dataIncoming.nama,
      nomorWhatsApp: dataIncoming.nomorWhatsApp || dataIncoming.nohp,
      tanggalMain: dataIncoming.tanggalMain || dataIncoming.tanggal,
      jamMulai: dataIncoming.jamMulai || dataIncoming.jam,
      durasiBermain: durasi,
      nomorMeja: namaMeja,
      statusPemesanan: dataIncoming.statusPemesanan || "Pending",
      waktuDibuat: dataIncoming.waktuDibuat || new Date().toISOString(),
      total: String(totalHarga)
    };

    const { data, error } = await supabase
      .from("reservasi")
      .insert([dataPesanan])
      .select();

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
    
    console.log("✅ Reservation saved successfully:", data[0]?.id);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("❌ Server error in /api/reservasi:", err);
    return res.status(500).json({ success: false, message: "Gagal memproses pesanan baru: " + err.message });
  }
});

/* 3. 🔥 TOMBOL START: Mengubah Status Menjadi "Playing" */
app.post("/api/kasir/start/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🎮 [POST] /api/kasir/start/${id} - Starting game`);
    
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
      console.error("❌ Supabase update error:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
    
    console.log(`✅ Game started for reservation ${id} at ${waktuJamMenit}`);
    return res.json({ success: true, message: "Meja biliar berhasil dimulai!", data });
  } catch (err) {
    console.error("❌ Server error in /api/kasir/start/:id:", err);
    return res.status(500).json({ success: false, message: "Gagal memproses aksi Start" });
  }
});

/* 4. 🔥 TOMBOL STOP: Mengubah Status Menjadi "Selesai" */
app.post("/api/kasir/stop/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🛑 [POST] /api/kasir/stop/${id} - Stopping game`);
    
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
      console.error("❌ Supabase update error:", error);
      return res.status(400).json({ success: false, message: error.message });
    }
    
    console.log(`✅ Game stopped for reservation ${id}`);
    return res.json({ success: true, message: "Meja biliar berhasil dihentikan!", data });
  } catch (err) {
    console.error("❌ Server error in /api/kasir/stop/:id:", err);
    return res.status(500).json({ success: false, message: "Gagal memproses aksi Stop" });
  }
});

/* 5. 🔥 TOMBOL STRUK: Ambil Data Supabase & Cetak Struk */
app.post("/api/kasir/print/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🖨️ [POST] /api/kasir/print/${id} - Printing receipt`);

    const { data: pesanan, error } = await supabase
      .from("reservasi")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !pesanan) {
      console.error(`❌ Reservation not found: ${id}`);
      return res.status(404).json({ success: false, message: "Data billing tidak ditemukan" });
    }

    const namaMeja = pesanan.nomorMeja || "Meja 1";
    const isVip = namaMeja.toLowerCase().includes("vip");
    const hargaPerJam = isVip ? 80000 : 50000;
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

    console.log(`✅ Receipt generated for reservation ${id}`);
    return res.json({ 
      success: true, 
      message: "Struk berhasil digenerate!", 
      data: strukNota 
    });
  } catch (err) {
    console.error("❌ Server error in /api/kasir/print/:id:", err);
    return res.status(500).json({ success: false, message: "Gagal memproses print struk" });
  }
});

// ========================================================
// 🛠️ ROUTE TEST DATABASE & RUNNING PORT
// ========================================================

/* Test Database Connection */
app.get("/test-db", async (req, res) => {
  console.log("🔍 [GET] /test-db - Testing database connection...");
  
  try {
    const { data, error } = await supabase.from("users").select("*");
    
    if (error) {
      console.error("❌ Database test error:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Database connection failed", 
        error: error.message 
      });
    }
    
    console.log(`✅ Database connected, users count: ${data?.length || 0}`);
    return res.json({ 
      success: true, 
      message: "Database connected successfully",
      usersCount: data?.length || 0,
      data 
    });
  } catch (err) {
    console.error("❌ Server error in /test-db:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: err.message 
    });
  }
});

/* Root endpoint - API Information */
app.get("/", (req, res) => {
  console.log("🏠 [GET] / - API root accessed");
  res.json({ 
    success: true,
    name: "Royal Cue Backend API",
    version: "2.0.0",
    status: "active",
    timestamp: new Date().toISOString(),
    endpoints: {
      root: "/",
      test_db: "/test-db",
      auth: {
        login: "/api/auth/login [POST]"
      },
      reservations: {
        list: "/api/kasir/reservasi [GET]",
        create: "/api/reservasi [POST]"
      },
      kasir: {
        start: "/api/kasir/start/:id [POST]",
        stop: "/api/kasir/stop/:id [POST]",
        print: "/api/kasir/print/:id [POST]"
      }
    },
    cors_allowed_origins: allowedOrigins
  });
});

/* 404 Handler untuk endpoint yang tidak ditemukan */
app.use((req, res) => {
  console.log(`⚠️ [404] ${req.method} ${req.url} - Not found`);
  res.status(404).json({ 
    success: false, 
    message: `Endpoint ${req.method} ${req.url} tidak ditemukan`,
    available_endpoints: [
      "GET /",
      "GET /test-db",
      "POST /api/auth/login",
      "GET /api/kasir/reservasi",
      "POST /api/reservasi",
      "POST /api/kasir/start/:id",
      "POST /api/kasir/stop/:id",
      "POST /api/kasir/print/:id"
    ]
  });
});

/* Global Error Handler */
app.use((err, req, res, next) => {
  console.error("🔥 Global error handler:", err);
  res.status(500).json({ 
    success: false, 
    message: "Internal server error",
    error: err.message 
  });
});

// ========================================================
// 🚀 START SERVER
// ========================================================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Royal Cue Backend Server`);
  console.log("=".repeat(50));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔗 Production: https://royal-cue-backend.onrender.com`);
  console.log("-".repeat(50));
  console.log(`✅ CORS enabled for origins:`);
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
  console.log("-".repeat(50));
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /`);
  console.log(`   GET  /test-db`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/kasir/reservasi`);
  console.log(`   POST /api/reservasi`);
  console.log(`   POST /api/kasir/start/:id`);
  console.log(`   POST /api/kasir/stop/:id`);
  console.log(`   POST /api/kasir/print/:id`);
  console.log("=".repeat(50));
});