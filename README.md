# bio-cupuberlari

Halaman link-in-bio untuk Instagram **@cupuberlari**: link, statistik lari, dan rekomendasi produk afiliasi. Semua isi diatur dari admin panel dan langsung terbit ke GitHub Pages.

- Halaman publik: `https://jadilebihfit.github.io/bio-cupuberlari/`
- Admin panel: `https://jadilebihfit.github.io/bio-cupuberlari/admin/`

## Setup sekali saja

1. **Aktifkan GitHub Pages**: Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save.
   (Atau dari admin panel: Lainnya → *Aktifkan / cek GitHub Pages*, kalau token punya izin Pages.)
2. **Buat token untuk admin panel**: https://github.com/settings/personal-access-tokens/new
   - Repository access: *Only select repositories* → `bio-cupuberlari`
   - Permissions → Repository: **Contents: Read and write**, **Pages: Read and write**
   - Generate, salin token.
3. Buka `/admin/`, tempel token, klik **Hubungkan**.

Token hanya disimpan di browser yang kamu pakai (localStorage), tidak pernah masuk ke repo.

## Cara pakai admin panel

| Tab | Isi |
|---|---|
| Profil | Nama 2 baris, keterangan, label kuning, foto utama (PNG transparan paling bagus), foto profil, ikon sosial media |
| Link | Tambah, ubah, urutkan, sembunyikan link. Ikon dari pustaka (Instagram, TikTok, Strava, Shopee, dll.), emoji, atau upload gambar. URL `#produk` membuka tab Produk |
| Produk | Produk afiliasi: nama, harga, harga coret (diskon dihitung otomatis), marketplace, kategori (jadi filter), label, teks tombol, foto |
| Statistik | Sampai 4 kartu angka |
| Tampilan | Preset warna, 8 warna, font judul & teks (Google Fonts), ukuran semua teks, sudut kartu |
| Lainnya | Tombol melayang, judul & deskripsi SEO, footer, unduh `data.json` |

Setiap perubahan langsung terlihat di pratinjau kanan dan tersimpan sebagai draf di browser. Klik **Publish** untuk membuat satu commit (`data.json` + gambar baru di `assets/uploads/`). GitHub Pages menerbitkan ulang dalam ±1 menit.

## Struktur

```
index.html          halaman publik
data.json           semua isi halaman (diubah oleh admin panel)
assets/site.css     tampilan, warna & ukuran lewat variabel CSS
assets/site.js      merender data.json + menerima pratinjau dari admin
assets/icons.js     pustaka ikon (Simple Icons CC0 + Lucide ISC)
assets/uploads/     gambar yang di-upload dari admin
admin/              admin panel (index.html, admin.css, admin.js)
```

Edit lokal: `python3 -m http.server 8000`, lalu buka http://localhost:8000 dan http://localhost:8000/admin/.
