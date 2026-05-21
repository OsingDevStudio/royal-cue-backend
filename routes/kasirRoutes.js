import express from "express";
import { supabase } from "../supabaseClient.js"; // Pastikan path ke client supabase Anda sudah benar

const router = express.Router();

/* ========================================================
   1. AMBIL SEMUA DATA RESERVASI (Untuk Dashboard Kasir)
   ======================================================== */
router.get("/reservasi", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reservasi")
      .select("*")
      .order("waktuDibuat", { ascending: false });
    
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Gagal mengambil data dari database" });
  }
});

/* ========================================================
   2. MENERIMA PESANAN BARU DARI PELANGGAN (POST /api/reservasi)
   ======================================================== */
router.post("/", async (req, res) => {
  try {
    const dataIncoming = req.body;
    const namaMeja = dataIncoming.nomorMeja || dataIncoming.meja || "";
    const durasi = parseInt(dataIncoming.durasiBermain || dataIncoming.durasi) || 1;
    
    // Hitung total harga otomatis
    const hargaPerJam = namaMeja.toLowerCase().includes("vip") ? 80000 : 50000;
    const totalHarga = hargaPerJam * durasi;

    const dataPesanan = {
      ...dataIncoming,
      total: totalHarga
    };

    const { data, error } = await supabase
      .from("reservasi")
      .insert([dataPesanan])
      .select();

    if (error) return res.status(400).json({ success: false, message: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Gagal memproses pesanan baru" });
  }
});

/* ========================================================
   🔥 3. TOMBOL START (POST /api/kasir/start/:id)
   ======================================================== */
router.post("/start/:id", async (req, res) => {
  const { id } = req.params;
  const waktuJamSekarang = new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });

  // 💡 Jaga-jaga: Kita update kolom statusPemesanan DAN kolom status (jika nama kolom berbeda di DB)
  const { data, error } = await supabase
    .from("reservasi")
    .update({ 
      statusPemesanan: "Playing",
      status: "Playing",
      jamMulai: waktuJamSekarang 
    })
    .eq("id", id)
    .select();

  if (error) {
    console.error("Error Supabase Start:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
  
  res.json({ success: true, message: "Meja biliar berhasil dimulai!", data });
});

/* ========================================================
   🔥 4. TOMBOL STOP (POST /api/kasir/stop/:id)
   ======================================================== */
router.post("/stop/:id", async (req, res) => {
  const { id } = req.params;

  // 💡 Kita update kedua kolom status menjadi "Selesai"
  const { data, error } = await supabase
    .from("reservasi")
    .update({ 
      statusPemesanan: "Selesai",
      status: "Selesai"
    })
    .eq("id", id)
    .select();

  if (error) {
    console.error("Error Supabase Stop:", error);
    return res.status(400).json({ success: false, message: error.message });
  }

  res.json({ success: true, message: "Meja biliar berhasil dihentikan!", data });
});

/* ========================================================
   🔥 5. TOMBOL STRUK (POST /api/kasir/print/:id)
   ======================================================== */
router.post("/print/:id", async (req, res) => {
  const { id } = req.params;

  const { data: pesanan, error } = await supabase
    .from("reservasi")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !pesanan) {
    return res.status(404).json({ success: false, message: "Data billing tidak ditemukan atau ID salah" });
  }

  const hargaPerJam = (pesanan.nomorMeja || pesanan.meja || "").toLowerCase().includes("vip") ? 80000 : 50000;
  const durasi = parseInt(pesanan.durasiBermain || pesanan.durasi) || 1;
  const totalBayar = pesanan.total && pesanan.total > 0 ? pesanan.total : (hargaPerJam * durasi);

  // Membuat format teks nota thermal struk
  const strukNota = `
====================================
         ROYAL CUE STUDIO           
====================================
ID Booking : ${pesanan.id}
Pelanggan  : ${pesanan.namaPelanggan || pesanan.nama || "Pelanggan"}
Meja       : ${pesanan.nomorMeja || pesanan.meja || "Meja -"}
Durasi     : ${durasi} Jam
Jam Mulai  : ${pesanan.jamMulai || "14:00"}
------------------------------------
Tarif/Jam  : Rp ${hargaPerJam.toLocaleString("id-ID")}
TOTAL      : Rp ${totalBayar.toLocaleString("id-ID")}
Status     : ${pesanan.statusPemesanan || pesanan.status || "Selesai"}
====================================
     TERIMA KASIH ATAS KUNJUNGANNYA 
====================================
  `;

  res.json({ 
    success: true, 
    message: "Struk berhasil digenerate!", 
    data: strukNota 
  });
});

export default router;