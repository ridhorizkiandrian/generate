# Struktur Proyek — Generate Soal Ujian

Ini struktur final yang perlu Anda tempatkan di root repo/hosting Anda (Vercel).
Tanda **[BARU]** / **[DIUBAH]** / **[TIDAK BERUBAH]** menunjukkan status tiap file
dibanding project asli yang Anda upload.

```
/ (root domain — https://generatesoalujian.xyz/)
├── index.html              [BARU]     ← Landing page baru (halaman utama)
├── robots.txt              [DIUBAH]   ← Domain diperbarui ke generatesoalujian.xyz
├── sitemap.xml             [DIUBAH]   ← Domain diperbarui + tambah URL /app/
│
├── api/
│   └── generate-soal.js    [DIUBAH]   ← AI sekarang juga membuat pedoman jawaban essay
│                                        (tetap HARUS di /api/ root)
│
└── app/                    ← Aplikasi Generate Soal Ujian yang lama, dipindah ke sini
    ├── index.html          [DIUBAH]   ← SEO + sidebar baru + Download Center +
    │                                     kunci jawaban + cetak/export PDF dgn pilihan versi
    ├── sidebar.js           [DIUBAH]   ← Menu "Semua Soal/Pilihan Ganda/Essay" dihapus,
    │                                     menu "Download Center" ditambah, logo jadi link ke "/"
    ├── bahasa.json          [DIUBAH]   ← Tambah teks Download Center + Kunci Jawaban (ID & EN)
    ├── ai-generator.js     [DIUBAH]   ← Bug jawaban benar AI yang dibuang sudah diperbaiki
    ├── theme.css           [TIDAK BERUBAH]
    ├── theme.js            [TIDAK BERUBAH]
    ├── custom-select.js    [TIDAK BERUBAH]
    ├── i18n_fallback.js    [TIDAK BERUBAH]
    └── footer.html         [TIDAK BERUBAH]
```

## Penting sebelum deploy

1. **Pindahkan file bersama-sama.** Folder `app/` harus berisi SEMUA file di
   atas sekaligus (bukan cuma `index.html`-nya) karena file-file itu saling
   memanggil dengan path relatif (`theme.css`, `sidebar.js`, dst). Kalau
   dipisah, aplikasi akan gagal memuat CSS/JS.

2. **Folder `images/`** yang dipakai `index.html` lama (mis. `images/side.png`,
   `images/bendera/indonesia.png`) belum saya sertakan di sini karena isinya
   file gambar biner milik Anda — salin folder `images/` yang sudah ada ke
   dalam `app/images/` juga.

3. **`api/generate-soal.js` WAJIB di root**, bukan di dalam `app/`. Ini karena
   frontend memanggilnya lewat path absolut `/api/generate-soal` — di Vercel,
   folder `/api` di root selalu jadi serverless function terlepas dari di
   mana file HTML-nya berada.

4. **Ganti link "Coba Sekarang"** di `index.html` (landing) kalau ternyata
   path aplikasi Anda bukan `/app/` — cari `href="/app/"` (ada beberapa,
   termasuk di navbar, hero, dan CTA akhir).

5. Gambar `og-cover.png`, `favicon.ico`, `apple-touch-icon.png` yang
   direferensikan di meta tag landing page juga perlu Anda siapkan sendiri
   di root (belum ada di file yang Anda upload).

## Apa yang sudah dikerjakan (Fase 1–4)

- **Fase 1:** Landing page baru (`/index.html`) — lengkap dengan SEO on-page,
  schema.org, responsive, tanpa pricing/subscription.
- **Fase 2:** SEO aplikasi lama disamakan ke domain baru; canonical/OG/schema
  `/app/` dibedakan dari landing (hindari duplicate content); internal
  linking (logo sidebar → landing).
- **Fase 3:** Sidebar — menu "Semua Soal/Pilihan Ganda/Essay" dihapus dari
  tampilan (fungsinya di kode TIDAK dihapus, cuma tombolnya disembunyikan,
  karena Beranda sudah menampilkan semua jenis soal). Menu **Download
  Center** baru ditambahkan — menampilkan seluruh file dari Bank Soal yang
  sama (tidak ada sistem penyimpanan baru), dengan aksi **Buka & Edit**,
  **Cetak**, **Download PDF**, dan **Hapus**.
- **Fase 4 (Kunci Jawaban):**
  - Modal Pilihan Ganda: radio "tandai jawaban benar" di tiap opsi → tersimpan
    sebagai field baru `correctIndex` (opsional, backward-compatible — soal
    lama tanpa field ini tetap terbuka & bisa diedit normal).
  - Modal Essay: textarea "Kunci Jawaban / Pedoman Jawaban" (opsional) →
    tersimpan sebagai field `answerKey`.
  - Kartu soal di daftar menampilkan badge kunci (ikon) kalau soal sudah
    punya kunci jawaban; opsi yang benar ditandai hijau.
  - **Bug diperbaiki** di `ai-generator.js`: sebelumnya jawaban benar dari
    hasil AI dibuang (hanya dipindah paksa ke opsi A tanpa pernah disimpan).
    Sekarang urutan opsi asli dipertahankan dan `correctIndex` benar-benar
    tersimpan.
  - `api/generate-soal.js`: AI sekarang juga diminta membuat `answerKey`
    (pedoman jawaban singkat) untuk soal essay, dengan validasi yang tidak
    menggagalkan soal kalau pedomannya kosong/tidak valid.
  - Semua perubahan sudah dicek dengan `node --check` (sintaks valid) dan
    `bahasa.json` divalidasi sebagai JSON yang sah.
- **Fase 5 (Print & Export PDF dengan Kunci Jawaban):**
  - `buildPages(showKey)` — **satu sumber layout** yang dipakai bersama oleh
    preview di layar (selalu tanpa kunci), export PDF, dan cetak. Kalau
    `showKey` aktif, `buildMcElement`/`buildEssayElement` menyisipkan
    penanda jawaban benar (opsi ditandai hijau + label tebal) dan kotak
    pedoman jawaban essay.
  - **Modal Export PDF** sekarang punya pilihan radio "Tanpa/Dengan Kunci
    Jawaban" (default: Tanpa — supaya tidak tidak sengaja membocorkan kunci).
  - **Fitur Cetak baru** (`btnPrintDoc` di Beranda + aksi "Cetak" di Download
    Center): memanggil `window.print()` **asli** (bukan screenshot seperti
    PDF), lewat halaman yang dirender ke `#printRoot` — elemen yang HANYA
    tampil melalui CSS `@media print` (seluruh UI aplikasi disembunyikan
    total saat mencetak, `@page{size:A4;margin:0}`, page-break per halaman).
    Modal pilihan versi yang sama dipakai di sini.
  - Download Center (Fase 3) sudah disambungkan ke kedua modal baru ini,
    tidak lagi memanggil `window.print()`/`exportPDF()` langsung tanpa
    pilihan versi.
  - Semua teks (ID & EN) untuk fase ini sudah ditambahkan ke `bahasa.json`.
  - Sudah diverifikasi: `#printRoot` adalah anak langsung `<body>` (depth 0,
    dicek terprogram) — penting supaya selector CSS `body > #printRoot`
    benar-benar berfungsi. Seluruh tag `<div>` di `index.html` seimbang
    (307 buka = 307 tutup). Sintaks JS (`node --check`) dan `bahasa.json`
    (JSON) tervalidasi ulang setelah semua perubahan fase ini.

### Catatan jujur soal Download Center & Kunci Jawaban

- Kunci jawaban **belum ditampilkan** di preview layar secara default (dan
  memang seharusnya tidak — preview tetap menampilkan lembar soal kosong
  seperti aslinya). Kunci jawaban hanya muncul saat pengguna secara sadar
  memilih "Dengan Kunci Jawaban" di modal Cetak/Export PDF.
- Kunci jawaban bersifat **opsional** — pengguna tidak diwajibkan menandai
  jawaban benar / mengisi pedoman essay supaya soal tetap bisa disimpan
  seperti biasa. Soal tanpa kunci jawaban akan tetap bisa dicetak/diekspor,
  hanya saja tidak ada apa pun yang ditambahkan meski opsi "Dengan Kunci
  Jawaban" dipilih.
- **Belum diuji secara manual** di browser sungguhan (klik tombol, lihat
  hasil print preview/PDF langsung) — validasi yang sudah dilakukan sejauh
  ini adalah pemeriksaan sintaks (`node --check`), keseimbangan tag HTML,
  dan pengecekan struktur DOM secara terprogram. Sangat disarankan untuk
  mencoba sendiri di browser sebelum deploy ke production.

## Fase selanjutnya yang disarankan

6. **Uji manual menyeluruh** di browser sungguhan: buat soal PG (dengan &
   tanpa kunci jawaban ditandai), buat soal essay (dengan & tanpa pedoman),
   lalu coba Cetak dan Export PDF di kedua mode "Tanpa/Dengan Kunci
   Jawaban" — pastikan hasilnya sesuai preview, halaman tidak terpotong
   aneh, dan mode "Tanpa Kunci Jawaban" benar-benar tidak membocorkan
   `correctIndex`/`answerKey` di manapun.
7. Pertimbangkan menambahkan tombol "Cetak" versi mobile (saat ini hanya
   ada di header desktop Beranda dan di Download Center, belum di
   mobile-header yang ruangnya terbatas).
