import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js"; 
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
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
    
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Gagal mengambil data dari database" });
  }
});

/* 2. Terima Pesanan Baru dari Pelanggan (Menghitung Total Otomatis) */
app.post("/api/reservasi", async (req, res) => {
  try {
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

    if (error) return res.status(400).json({ success: false, message: error.message });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Gagal memproses pesanan baru" });
  }
});

/* 3. 🔥 TOMBOL START: Mengubah Status Menjadi "Playing" */
app.post("/api/kasir/start/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Format jam menit biasa untuk kolom jamMulai ("17:30")
    const waktuJamMenit = new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    
    // 💡 SOLUSI AMAN: Menggunakan format string YYYY-MM-DD HH:MM:SS yang dicintai PostgreSQL/Supabase
    const waktuSQL = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const { data, error } = await supabase
      .from("reservasi")
      .update({ 
        statusPemesanan: "Playing", 
        jamMulai: waktuJamMenit,        
        start_time: waktuSQL // Menggunakan format yang ramah database
      })
      .eq("id", id)
      .select();

    if (error) return res.status(400).json({ success: false, message: error.message });
    return res.json({ success: true, message: "Meja biliar berhasil dimulai!", data });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Gagal memproses aksi Start" });
  }
});

/* 4. 🔥 TOMBOL STOP: Mengubah Status Menjadi "Selesai" */
app.post("/api/kasir/stop/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // 💡 SOLUSI AMAN: Format string timestamp standar SQL
    const waktuSQL = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const { data, error } = await supabase
      .from("reservasi")
      .update({ 
        statusPemesanan: "Selesai",
        end_time: waktuSQL // Menggunakan format yang ramah database
      })
      .eq("id", id)
      .select();

    if (error) return res.status(400).json({ success: false, message: error.message });
    return res.json({ success: true, message: "Meja biliar berhasil dihentikan!", data });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Gagal memproses aksi Stop" });
  }
});

/* 5. 🔥 TOMBOL STRUK: Ambil Data Supabase & Cetak Struk */
app.post("/api/kasir/print/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: pesanan, error } = await supabase
      .from("reservasi")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !pesanan) {
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

    return res.json({ 
      success: true, 
      message: "Struk berhasil digenerate!", 
      data: strukNota 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Gagal memproses print struk" });
  }
});

// ========================================================
// 🛠️ ROUTE TEST DATABASE & RUNNING PORT
// ========================================================
app.get("/test-db", async (req, res) => {
  const { data, error } = await supabase.from("users").select("*");
  res.json({ data, error });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});