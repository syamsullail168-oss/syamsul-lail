

  /* =====================
     LOGIKA HISAB KALKULATOR WARIS
     ===================== */

function hitungWaris() {

  /* =====================
     AMBIL HARTA
     ===================== */
  const inputHarta = document.querySelector('.input-group input[type="number"]');
  const harta = Number(inputHarta.value || 0);

  if (harta <= 0) {
    alert("Harta belum diisi");
    return; // ⛔ STOP TOTAL
  }

  /* =====================
     AMBIL AHLI WARIS
     ===================== */
  const rows = document.querySelectorAll(".waris-row");
  const ahli = {};

  rows.forEach(row => {
    const cek = row.querySelector('input[type="checkbox"]');
    if (!cek || !cek.checked) return;

    const nama = row.querySelector('.nama').innerText.trim();
    const jumlah = Number(row.querySelector('.jumlah').innerText || 0);

    if (jumlah > 0) {
      ahli[nama] = jumlah;
    }
  });

  // ❌ TIDAK ADA AHLI WARIS
  if (Object.keys(ahli).length === 0) {
    alert("Pilih minimal satu ahli waris");
    return; // ⛔ STOP
  }

  /* =====================
     HITUNGAN DASAR
     ===================== */let sisa = harta;
const hasil = [];

const adaAnak = ahli["Anak Laki-laki"] || ahli["Anak Perempuan"];

// ISTRI
if (ahli["Istri"]) {
  const bagian = adaAnak ? 1/8 : 1/4;
  const nilai = harta * bagian;

  hasil.push({
    nama: "Istri",
    bagian: adaAnak ? "1/8" : "1/4",
    nilai
  });

  sisa -= nilai;
}

// SUAMI
if (ahli["Suami"]) {
  const bagian = adaAnak ? 1/4 : 1/2;
  const nilai = harta * bagian;

  hasil.push({
    nama: "Suami",
    bagian: adaAnak ? "1/4" : "1/2",
    nilai
  });

  sisa -= nilai;
}

// ANAK PEREMPUAN (SATU, TANPA ANAK LAKI-LAKI)
if (ahli["Anak Perempuan"] === 1 && !ahli["Anak Laki-laki"]) {
  const furudh = harta * 1/2;
  sisa -= furudh;

  const nilaiAkhir = furudh + sisa;
  sisa = 0;

  hasil.push({
    nama: "Anak Perempuan",
    bagian: "1/2 + Radd",
    nilai: nilaiAkhir
  });
}

/* =====================
   OUTPUT TABEL
   ===================== */

let html = `
<table border="1" cellpadding="6" cellspacing="0">
  <thead>
    <tr>
      <th>Nama Ahli Waris</th>
      <th>Bagian</th>
      <th>Jumlah (Rp)</th>
    </tr>
  </thead>
  <tbody>
`;

hasil.forEach(h => {
  html += `
    <tr style="text-align:center;">
      <td>${h.nama}</td>
      <td>${h.bagian}</td>
      <td>${h.nilai.toLocaleString("id-ID")}</td>
    </tr>
  `;
});

html += `
  </tbody>
</table>
`;
  
  document.getElementById("hasilWaris").innerHTML = html;

  // PINDAH PANEL (SETELAH SEMUA VALID)
  document.getElementById("panelKalkulatorWaris").classList.add("hidden");
  document.getElementById("panelHasilWaris").classList.remove("hidden");
}

/* WAJIB ID */
document.getElementById("btnHitungWaris").onclick = hitungWaris;
