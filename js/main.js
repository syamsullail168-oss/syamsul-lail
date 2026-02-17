
// ============================================
// KONFIGURASI & SETTINGS
// ============================================
const lokasi = {lat: -6.786, lon: 107.173, tz: 7};
let today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();

// UTILITY FUNCTIONS
const d2r = d => d * Math.PI / 180;
const r2d = r => r * 180 / Math.PI;

function time(x) {
  x = (x + 24) % 24;
  let h = Math.floor(x);
  let m = Math.round((x - h) * 60);
  if (m === 60) {
    h = (h + 1) % 24;
    m = 0;
  }
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function timeToSeconds(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 3600 + m * 60;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ============================================
// HISAB FUNCTIONS
// ============================================
function julianDay(y, m, d) {
  // Menggunakan UTC midday untuk akurasi
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  
  let Y = year;
  let M = month;
  if (M <= 2) {
    Y--;
    M += 12;
  }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) +
         Math.floor(30.6001 * (M + 1)) +
         day + B - 1524.5;
}

function solar(jd) {
  const T = (jd - 2451545) / 36525;
  const L = (280.46646 + 36000.76983 * T) % 360;
  const g = 357.52911 + 35999.05029 * T;

  const C = (1.914602 - 0.004817 * T) * Math.sin(d2r(g)) +
           0.019993 * Math.sin(d2r(2 * g));

  const λ = L + C;
  const ε = 23.439291 - 0.0130042 * T;

  const δ = r2d(Math.asin(Math.sin(d2r(ε)) * Math.sin(d2r(λ))));

  const EoT = 4 * r2d(
    Math.tan(d2r(ε / 2)) ** 2 * Math.sin(d2r(2 * L)) -
    2 * 0.016708 * Math.sin(d2r(g))
  );

  return { δ, EoT };
}

function hourAngle(lat, δ, h) {
  let value = (Math.sin(d2r(h)) - Math.sin(d2r(lat)) * Math.sin(d2r(δ))) /
              (Math.cos(d2r(lat)) * Math.cos(d2r(δ)));
  
  // Clamp value ke range [-1, 1] untuk menghindari NaN
  value = Math.max(-1, Math.min(1, value));
  
  return r2d(Math.acos(value));
}

function dip(h) {
  return 0.0293 * Math.sqrt(h);
}

// ============================================
// HITUNG JADWAL SHOLAT
// ============================================
function hitungSholat(lat, lon, tz, settings) {
  const d = new Date();
  const jd = julianDay(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const { δ, EoT } = solar(jd);

  const dz = 12 + tz - lon / 15 - EoT / 60;
  const iht = settings.ihtiyat / 60;

  // Koreksi ketinggian
  const dipH = (settings.useAltitude && settings.altitude > 0) 
    ? dip(settings.altitude) 
    : 0;

  // Perhitungan waktu sholat
  const subuh = dz - hourAngle(lat, δ, -20 - dipH) / 15 + iht;
  const terbit = dz - hourAngle(lat, δ, -1 - dipH) / 15 - iht;
  const dhuha = terbit + (4.5 / 15) + iht; // 4.5° setelah terbit
  const maghrib = dz + hourAngle(lat, δ, -1 - dipH) / 15 + iht;
  const isya = dz + hourAngle(lat, δ, -18 - dipH) / 15 + iht;

  const asAlt = r2d(Math.atan(1 / (1 + Math.tan(Math.abs(d2r(lat - δ))))));
  const ashar = dz + hourAngle(lat, δ, asAlt) / 15 + iht;

  const imsak = subuh - 10 / 60;

  return {
    imsak: time(imsak),
    subuh: time(subuh),
    terbit: time(terbit),
    dhuha: time(dhuha),
    dzuhur: time(dz + iht),
    ashar: time(ashar),
    maghrib: time(maghrib),
    isya: time(isya)
  };
}

function updateSholatUI(j) {
  for (let k in j) {
    const el = document.getElementById(k);
    if (el) el.innerText = j[k];
  }
}

// ============================================
// NEXT SHOLAT & COUNTDOWN
// ============================================
function getNextSholat(jadwal) {
  const urutan = [
    { id: 'subuh', label: 'Subuh' },
    { id: 'terbit', label: 'Terbit' },
    { id: 'dhuha', label: 'Dhuha' },
    { id: 'dzuhur', label: 'Dzuhur' },
    { id: 'ashar', label: 'Ashar' },
    { id: 'maghrib', label: 'Maghrib' },
    { id: 'isya', label: 'Isya' }
  ];

  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  
  // Cari waktu sholat berikutnya
  for (let item of urutan) {
    const waktuSec = timeToSeconds(jadwal[item.id]);
    if (waktuSec > nowSec) {
      return {
        label: item.label,
        time: jadwal[item.id],
        tomorrow: false
      };
    }
  }
  
  // Jika semua sudah lewat, ambil subuh besok
  return {
    label: 'Subuh',
    time: jadwal.subuh,
    tomorrow: true
  };
}

let countdownInterval = null;

function startCountdown(jadwal) {
  // Hapus interval lama jika ada
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  countdownInterval = setInterval(() => {
    const next = getNextSholat(jadwal);
    const now = new Date();
    const target = new Date();
    
    const [h, m] = next.time.split(':').map(Number);
    target.setHours(h, m, 0, 0);
    if (next.tomorrow) target.setDate(target.getDate() + 1);

    let diff = Math.max(0, Math.floor((target - now) / 1000));
    const hh = Math.floor(diff / 3600);
    const mm = Math.floor((diff % 3600) / 60);
    const ss = diff % 60;

    const n = document.getElementById('nextSholatName');
    const c = document.getElementById('countdownTime');
    if (n) n.innerText = `${next.label} ${next.time}`;
    if (c) c.innerText = `- ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  }, 1000);
}

// ============================================
// KALENDER & HIJRIYAH
// ============================================
const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const pasaran = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'];
const namaBulanHijri = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
];

// Data hisab untuk tahun Hijriyah
const hijriMonthLengths = {
  1446: [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 29, 29],
  1447: [30, 29, 30, 29, 30, 30, 30, 30, 29, 30, 29, 29],
  1448: [30, 29, 29, 30, 30, 29, 30, 30, 30, 29, 30, 29],
};

// Fungsi untuk mendapatkan panjang bulan dengan fallback yang lebih baik
function getHijriMonthLength(year, month) {
  // Coba dapatkan dari data yang ada
  if (hijriMonthLengths[year] && hijriMonthLengths[year][month - 1]) {
    return hijriMonthLengths[year][month - 1];
  }
  
  // Fallback: hisab sederhana (bergantian 30/29)
  // Bulan ganjil = 30, genap = 29, kecuali Dzulhijjah (bulan 12) bisa 30/29
  if (month === 12) {
    // Dzulhijjah: asumsi 30 untuk tahun kabisat (sederhana)
    return (year % 30 === 0) ? 30 : 29;
  }
  return (month % 2 === 1) ? 30 : 29;
}

const hijriAnchor = {
  startDate: new Date(2025, 0, 1),
  day: 1,
  month: 7,
  year: 1446
};

function toArab(n) {
  const a = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n).replace(/\d/g, d => a[d]);
}

function getHijri(date) {
  let diff = Math.floor((date - hijriAnchor.startDate) / 86400000);
  let { day, month, year } = hijriAnchor;

  while (diff !== 0) {
    if (diff > 0) {
      const len = getHijriMonthLength(year, month);
      day++;
      if (day > len) {
        day = 1;
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }
      diff--;
    } else {
      month--;
      if (month < 1) {
        month = 12;
        year--;
      }
      const len = getHijriMonthLength(year, month);
      day = len;
      diff++;
    }
  }
  return { day, month, year };
}

function getPasaran(date) {
  const ref = new Date(2020, 0, 1);
  const diff = Math.floor((date - ref) / 86400000);
  return pasaran[(diff % 5 + 5) % 5];
}

function renderCalendar() {
  const daysEl = document.getElementById('calendarDays');
  if (!daysEl) return;

  daysEl.innerHTML = '';

  const monthNameEl = document.getElementById('monthName');
  const yearNameEl = document.getElementById('yearName');
  if (monthNameEl) monthNameEl.innerText = namaBulan[currentMonth];
  if (yearNameEl) yearNameEl.innerText = currentYear;

  // Header Hijriyah
  const hijriStart = getHijri(new Date(currentYear, currentMonth, 1));
  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  const hijriEnd = getHijri(new Date(currentYear, currentMonth, lastDay));

  let hijriText;
  if (hijriStart.month !== hijriEnd.month) {
    if (hijriStart.year === hijriEnd.year) {
      hijriText = `${namaBulanHijri[hijriStart.month - 1]} – ${namaBulanHijri[hijriEnd.month - 1]} ${toArab(hijriStart.year)}`;
    } else {
      hijriText = `${namaBulanHijri[hijriStart.month - 1]} ${toArab(hijriStart.year)} – ${namaBulanHijri[hijriEnd.month - 1]} ${toArab(hijriEnd.year)}`;
    }
  } else {
    hijriText = `${namaBulanHijri[hijriStart.month - 1]} ${toArab(hijriStart.year)}`;
  }

  const hijriEl = document.getElementById('hijriMonthYear');
  if (hijriEl) hijriEl.innerText = hijriText;

  // Data hari ini
  const todayDate = new Date();
  const tDate = todayDate.getDate();
  const tMonth = todayDate.getMonth();
  const tYear = todayDate.getFullYear();

  // Hitung hari dalam bulan
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrev = new Date(currentYear, currentMonth, 0).getDate();

  // Bulan sebelumnya
  for (let i = firstDay - 1; i >= 0; i--) {
    daysEl.innerHTML += `<div class="day empty prev"><span class="date">${daysInPrev - i}</span></div>`;
  }

  // Bulan aktif
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const h = getHijri(date);

    let cls = 'day';
    if (date.getDay() === 0) cls += ' ahad';
    if (date.getDay() === 5) cls += ' jumat';

    if (d === tDate && currentMonth === tMonth && currentYear === tYear) {
      cls += ' today';
    }

    daysEl.innerHTML += `
      <div class="${cls}">
        <span class="date">${d}</span>
        <span class="hijri">${toArab(h.day)}</span>
        <span class="pasaran">${getPasaran(date)}</span>
      </div>`;
  }

  // Bulan berikutnya
  const totalUsed = firstDay + daysInMonth;
  const totalCell = Math.ceil(totalUsed / 7) * 7;
  const sisa = totalCell - daysEl.children.length;

  for (let d = 1; d <= sisa; d++) {
    daysEl.innerHTML += `<div class="day empty next"><span class="date">${d}</span></div>`;
  }
}

// ============================================
// INITIALIZATION - SEMUA DALAM SATU EVENT LISTENER
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  
  // ===== SETTINGS =====
  const settings = {
    ihtiyat: Number(localStorage.getItem('ihtiyat')) || 0,
    altitude: Number(localStorage.getItem('altitude')) || 0,
    useAltitude: localStorage.getItem('use_altitude') !== 'false'
  };
  
  // ===== ELEMEN DOM =====
  // Menu & Pages
  const menuPengaturan = document.getElementById('menuPengaturan');
  const settingsPage = document.getElementById('settingsPage');
  const closeSettings = document.getElementById('closeSettings');
  
  // Ihtiyat
  const sheet = document.getElementById('sheetIhtiyat');
  const openBtn = document.getElementById('openIhtiyat');
  const valueText = document.getElementById('ihtiyatValue');
  
  // Altitude
  const toggleAltitude = document.getElementById('toggleAltitude');
  const openAltitude = document.getElementById('openAltitude');
  const altitudeValue = document.getElementById('altitudeValue');
  const altitudeStatus = document.getElementById('altitudeStatus');
  const altitudeDesc = document.getElementById('altitudeDesc');
  
  // Location
  const locationModeValue = document.getElementById('locationModeValue');
  const locationModeDesc = document.getElementById('locationModeDesc');
  const coordinateDesc = document.getElementById('coordinateDesc');
  const openLocationMode = document.getElementById('openLocationMode');
  const openCoordinate = document.getElementById('openCoordinate');
  
  // Calendar
  const prevMonth = document.getElementById('prevMonth');
  const nextMonth = document.getElementById('nextMonth');
  
  // ===== FUNGSI-FUNGSI UI =====
  
  // Ihtiyat
  if (valueText) valueText.innerText = settings.ihtiyat + ' Menit';
  
  openBtn?.addEventListener('click', () => sheet?.classList.add('show'));
  sheet?.querySelector('.sheet-close')?.addEventListener('click', () => sheet.classList.remove('show'));
  
  sheet?.querySelectorAll('.sheet-option').forEach(opt => {
    opt.addEventListener('click', () => {
      settings.ihtiyat = Number(opt.dataset.val);
      localStorage.setItem('ihtiyat', settings.ihtiyat);
      if (valueText) valueText.innerText = settings.ihtiyat + ' Menit';
      sheet.classList.remove('show');
      
      // Update jadwal
      const j = hitungSholat(lokasi.lat, lokasi.lon, lokasi.tz, settings);
      updateSholatUI(j);
      startCountdown(j);
    });
  });
  
  // Altitude
  function updateAltitudeUI() {
    if (altitudeValue) altitudeValue.innerText = settings.altitude + ' MDPL';
    if (altitudeStatus) altitudeStatus.innerText = settings.useAltitude ? 'Aktif' : 'Nonaktif';
    if (altitudeDesc) altitudeDesc.innerText = settings.useAltitude ? 'Aktif' : 'Nonaktif';
  }
  
  function applyAltitude() {
    const j = hitungSholat(lokasi.lat, lokasi.lon, lokasi.tz, settings);
    updateSholatUI(j);
    startCountdown(j);
  }
  
  toggleAltitude?.addEventListener('click', () => {
    settings.useAltitude = !settings.useAltitude;
    localStorage.setItem('use_altitude', settings.useAltitude);
    updateAltitudeUI();
    applyAltitude();
  });
  
  openAltitude?.addEventListener('click', (e) => {
    e.stopPropagation();
    
    if (!settings.useAltitude) {
      if (confirm('Ketinggian nonaktif. Aktifkan sekarang?')) {
        settings.useAltitude = true;
        localStorage.setItem('use_altitude', true);
        updateAltitudeUI();
      } else {
        return;
      }
    }
    
    const v = prompt('        Masukkan ketinggian tempat', settings.altitude);
    if (v === null || isNaN(v)) return;
    
    settings.altitude = Number(v);
    localStorage.setItem('altitude', settings.altitude);
    
    updateAltitudeUI();
    applyAltitude();
  });
  
  // Location
  const locationSettings = {
    mode: localStorage.getItem('loc_mode') || 'auto',
    lat: Number(localStorage.getItem('lat')) || lokasi.lat,
    lon: Number(localStorage.getItem('lon')) || lokasi.lon,
  };
  
  function updateLocationUI() {
    if (!locationModeValue) return;
    locationModeValue.innerText = locationSettings.mode === 'auto' ? 'Otomatis' : 'Manual';
    if (locationModeDesc) locationModeDesc.innerText = locationModeValue.innerText;
    if (coordinateDesc) {
      coordinateDesc.innerText = locationSettings.lat.toFixed(3) + ', ' + locationSettings.lon.toFixed(3);
    }
  }
  
  function applyLocation() {
    lokasi.lat = locationSettings.lat;
    lokasi.lon = locationSettings.lon;
    const j = hitungSholat(lokasi.lat, lokasi.lon, lokasi.tz, settings);
    updateSholatUI(j);
    startCountdown(j);
  }
  
  function getAutoLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      locationSettings.lat = pos.coords.latitude;
      locationSettings.lon = pos.coords.longitude;
      localStorage.setItem('lat', locationSettings.lat);
      localStorage.setItem('lon', locationSettings.lon);
      updateLocationUI();
      applyLocation();
    });
  }
  
  openLocationMode?.addEventListener('click', () => {
    if (locationSettings.mode === 'auto') {
      locationSettings.mode = 'manual';
    } else {
      locationSettings.mode = 'auto';
      getAutoLocation();
    }
    localStorage.setItem('loc_mode', locationSettings.mode);
    updateLocationUI();
  });
  
  openCoordinate?.addEventListener('click', () => {
    if (locationSettings.mode !== 'manual') {
      alert('Mode lokasi harus Manual untuk mengubah koordinat');
      return;
    }
    const lat = prompt('Masukkan Latitude', locationSettings.lat);
    const lon = prompt('Masukkan Longitude', locationSettings.lon);
    if (lat === null || lon === null) return;
    if (isNaN(lat) || isNaN(lon)) {
      alert('Koordinat tidak valid');
      return;
    }
    locationSettings.lat = Number(lat);
    locationSettings.lon = Number(lon);
    localStorage.setItem('lat', locationSettings.lat);
    localStorage.setItem('lon', locationSettings.lon);
    updateLocationUI();
    applyLocation();
  });
  
  // Menu Settings
  if (menuPengaturan && settingsPage && closeSettings) {
    settingsPage.style.display = 'none';
    menuPengaturan.onclick = () => settingsPage.style.display = 'block';
    closeSettings.onclick = () => settingsPage.style.display = 'none';
  }
  
  // Calendar Navigation
  prevMonth?.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });
  
  nextMonth?.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });
  
  // ===== INITIAL RENDER =====
  updateAltitudeUI();
  updateLocationUI();
  
  if (locationSettings.mode === 'auto') {
    getAutoLocation();
  } else {
    applyLocation();
  }
  
  const jadwal = hitungSholat(lokasi.lat, lokasi.lon, lokasi.tz, settings);
  updateSholatUI(jadwal);
  startCountdown(jadwal);
  
  renderCalendar();
});

const resetBtn = document.getElementById('resetSettings');

resetBtn?.addEventListener('click',()=>{
  if(!confirm('Reset semua pengaturan ke default?')) return;

  localStorage.clear();
  location.reload();
});

const openTheme = document.getElementById("openTheme");
const themeDesc = document.getElementById("themeDesc");
const themeValue = document.getElementById("themeValue");

// ambil dari storage
let theme = localStorage.getItem("theme") || "dark";

// terapkan saat load
applyTheme(theme);

// toggle saat diklik
openTheme.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  applyTheme(theme);
});

// fungsi utama
function applyTheme(mode) {
  if (mode === "light") {
    document.body.classList.add("light");
    themeDesc.textContent = "Terang";
    themeValue.className = "bi bi-sun";
  } else {
    document.body.classList.remove("light");
    themeDesc.textContent = "Gelap";
    themeValue.className = "bi bi-moon";
  }
  localStorage.setItem("theme", mode);
}

/* ===============================
   RESET (opsional)
================================ */
function resetTheme() {
  applyTheme("dark");
}

/* ===============================
   ELEMENT UTAMA HISAB
================================ */
const btnMenuHisab   = document.getElementById('menu-hisab'); // footer
const overlayHisab   = document.getElementById('hisabOverlay');
const panelHisab     = document.getElementById('panelHisab');
const btnCloseHisab  = document.getElementById('closeHisab');


/* ===============================
   TAB & KONTEN HISAB
================================ */
const tabs = document.querySelectorAll('.hisab-tabs .tab');

const inputIjtima   = document.getElementById('hisabAkhirBulan');
const panelInputSholat = document.getElementById('panelInputSholat');
const contentKonversiH_M  = document.getElementById('konveriH_M');
const contentKonversiM_H  = document.getElementById('konveriM_H');

const contents = [inputIjtima, panelInputSholat, contentKonversiH_M, contentKonversiM_H];

/* ===============================
   PANEL HASIL HISAB
================================ */
const panelHasilHisab = document.getElementById('panelHasilHisab');
const btnProsesHisab  = document.getElementById('btnProsesHisab');
const btnBackToIjtima = document.getElementById('btnBackToIjtima');
/* ===============================
   OPEN PANEL HISAB
================================ */
if (btnMenuHisab) {
  btnMenuHisab.onclick = () => {
    overlayHisab.classList.remove('hidden');
    panelHisab.classList.remove('hidden');

    // reset tab
    tabs.forEach(t => t.classList.remove('active'));
    tabs[0].classList.add('active');

    contents.forEach(c => c.classList.add('hidden'));
    inputIjtima.classList.remove('hidden');

    // pastikan panel hasil tertutup
    if (panelHasilHisab) panelHasilHisab.classList.add('hidden');
  };
}

/* ===============================
   CLOSE PANEL HISAB
================================ */
function closeHisabPanel(){
  overlayHisab.classList.add('hidden');
  panelHisab.classList.add('hidden');
  if (panelHasilHisab) panelHasilHisab.classList.add('hidden');
}

overlayHisab.onclick  = closeHisabPanel;
btnCloseHisab.onclick = closeHisabPanel;

/* ===============================
   TAB HANDLER
================================ */
tabs.forEach((tab, index) => {
  tab.onclick = () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    contents.forEach(c => c.classList.add('hidden'));
    contents[index].classList.remove('hidden');
  };
});

/* ===============================
   HISAB URFI - KONVERSI HIJRI KE MASEHI
================================ */

const btnProsesKonversiH_M = document.getElementById("btnProsesKonversiH_M");
const panelHasilKonversiH_M  = document.getElementById("panelHasilKonversiH_M");
const btnBackToKonversiH_M = document.getElementById("btnBackToKonversiH_M");
const hasilKonversiH_M  = document.getElementById("hasilKonversiH_M");

if(btnProsesKonversiH_M){
  btnProsesKonversiH_M.onclick=()=>{contentKonversiH_M.classList.add("hidden");panelHasilKonversiH_M.classList.remove("hidden");const tgl=parseInt(document.getElementById('inputTanggalHM').value);const bln=parseInt(document.getElementById('inputBulanHM').value);const thn=parseInt(document.getElementById('inputTahunHM').value);const bulanHijriyah={1:"Muharram",2:"Safar",3:"Rabiul Awal",4:"Rabiul Akhir",5:"Jumadil Awal",6:"Jumadil Akhir",7:"Rajab",8:"Sya'ban",9:"Ramadhan",10:"Syawal",11:"Dzulqo'dah",12:"Dzulhijjah"};const namaBulanHijri=bulanHijriyah[bln]||`Bulan ${bln}`;let tth=thn-1;let daor=Math.trunc(tth/30);let st=tth%30;let jth=daor*10631;let thst=st*354;let ak;if(st<=4)ak=1;else if(st<=6)ak=2;else if(st<=9)ak=3;else if(st<=12)ak=4;else if(st<=15)ak=5;else if(st<=17)ak=6;else if(st<=20)ak=7;else if(st<=23)ak=8;else if(st<=25)ak=9;else if(st<=29)ak=10;const jhdsMap={1:0,2:30,3:59,4:89,5:118,6:148,7:177,8:207,9:236,10:266,11:295,12:325};let jhds=jhdsMap[bln];let jhhk=jth+thst+ak+jhds+tgl;let jhmk=227014+jhhk;let tkt_ttM=jhmk/365.2425;let ttM=Math.trunc(tkt_ttM);let sttm=tkt_ttM-ttM;let jhp=Math.round(sttm*365.2425);let thnm=ttM+1;let b_masehi,b_masehi_nama;if(jhp<=31){b_masehi=1;b_masehi_nama="Januari";}else if(jhp<=59){b_masehi=2;b_masehi_nama="Februari";}else if(jhp<=90){b_masehi=3;b_masehi_nama="Maret";}else if(jhp<=120){b_masehi=4;b_masehi_nama="April";}else if(jhp<=151){b_masehi=5;b_masehi_nama="Mei";}else if(jhp<=181){b_masehi=6;b_masehi_nama="Juni";}else if(jhp<=212){b_masehi=7;b_masehi_nama="Juli";}else if(jhp<=243){b_masehi=8;b_masehi_nama="Agustus";}else if(jhp<=273){b_masehi=9;b_masehi_nama="September";}else if(jhp<=304){b_masehi=10;b_masehi_nama="Oktober";}else if(jhp<=334){b_masehi=11;b_masehi_nama="November";}else{b_masehi=12;b_masehi_nama="Desember";}let x_tglmm;switch(b_masehi){case 1:x_tglmm=0;break;case 2:x_tglmm=31;break;case 3:x_tglmm=59;break;case 4:x_tglmm=90;break;case 5:x_tglmm=120;break;case 6:x_tglmm=151;break;case 7:x_tglmm=181;break;case 8:x_tglmm=212;break;case 9:x_tglmm=243;break;case 10:x_tglmm=273;break;case 11:x_tglmm=304;break;case 12:x_tglmm=334;break;default:x_tglmm=0;}let tglmm=Math.round(jhp-x_tglmm);let xh=jhhk%7;let hari;switch(xh){case 0:hari="Kamis";break;case 1:hari="Jumat";break;case 2:hari="Sabtu";break;case 3:hari="Minggu";break;case 4:hari="Senin";break;case 5:hari="Selasa";break;case 6:hari="Rabu";break;default:hari="-";}let xp=jhhk%5;let pasar;switch(xp){case 0:pasar="Kliwon";break;case 1:pasar="Legi";break;case 2:pasar="Pahing";break;case 3:pasar="Pon";break;case 4:pasar="Wage";break;default:pasar="-";}let hasilTgl=tglmm===0?31:tglmm;hasilKonversiH_M.innerHTML=`<div class="card sholat-list"><div class="row"><span>ttH</span><span>${tth}</span></div><div class="row"><span>daor</span><span>${daor}</span></div><div class="row"><span>st</span><span>${st}</span></div><div class="row"><span>jth</span><span>${jth}</span></div><div class="row"><span>thst</span><span>${thst}</span></div><div class="row"><span>ak</span><span>${ak}</span></div><div class="row"><span>jhds</span><span>${jhds}</span></div><div class="row"><span>jhhk</span><span>${jhhk}</span></div><div class="row"><span>jhmk</span><span>${jhmk}</span></div><div class="row"><span>tkt(ttM)</span><span>${tkt_ttM.toFixed(6)}</span></div><div class="row"><span>ttM</span><span>${ttM}</span></div><div class="row"><span>sttm</span><span>${sttm.toFixed(6)}</span></div><div class="row"><span>jhp</span><span>${Math.round(jhp)}</span></div><div class="row"><span>thnm</span><span>${thnm}</span></div><div class="row"><span>b-masehi</span><span>${b_masehi_nama}</span></div><div class="row"><span>x(tglmm)</span><span>${x_tglmm}</span></div><div class="row"><span>tglmm</span><span>${tglmm}</span></div><div class="row"><span>xh</span><span>${xh}</span></div><div class="row"><span>h</span><span>${hari}</span></div><div class="row"><span>xp</span><span>${xp}</span></div><div class="row"><span>p</span><span>${pasar}</span></div><div class="poinHasilHisab"><div><span>${tgl} ${namaBulanHijri} ${thn}</span></div><div><span>${hari} ${pasar}, ${hasilTgl} ${b_masehi_nama} ${thnm}</span></div></div>`;};}



if (btnBackToKonversiH_M) {
  btnBackToKonversiH_M.onclick = () => {
    contentKonversiH_M.classList.remove("hidden");
    panelHasilKonversiH_M.classList.add("hidden");
  };
}

/* ===============================
   HISAB URFI - KONVERSI MASEHI KE HIJRI
================================ */


const btnProsesKonversiM_H = document.getElementById("btnProsesKonversiM_H");
const panelHasilKonversiM_H  = document.getElementById("panelHasilKonversiM_H");
const btnBackToKonversiM_H = document.getElementById("btnBackToKonversiM_H");
const hasilKonversiM_H  = document.getElementById("hasilKonversiM_H");

if(btnProsesKonversiM_H){btnProsesKonversiM_H.onclick=()=>{contentKonversiM_H.classList.add("hidden");panelHasilKonversiM_H.classList.remove("hidden");const v1=parseInt(document.getElementById('inputTanggalMH').value);const v2=parseInt(document.getElementById('inputBulanMH').value);const v3=parseInt(document.getElementById('inputTahunMH').value);const mN={1:"Muharram",2:"Safar",3:"Rabiul Awal",4:"Rabiul Akhir",5:"Jumadil Awal",6:"Jumadil Akhir",7:"Rajab",8:"Sya'ban",9:"Ramadhan",10:"Syawal",11:"Dzulqo'dah",12:"Dzulhijjah"};const mM={1:"Januari",2:"Februari",3:"Maret",4:"April",5:"Mei",6:"Juni",7:"Juli",8:"Agustus",9:"September",10:"Oktober",11:"November",12:"Desember"};let a=Math.trunc((14-v2)/12);let y=v3+4800-a;let m=v2+12*a-3;let jdn=v1+Math.trunc((153*m+2)/5)+365*y+Math.trunc(y/4)-Math.trunc(y/100)+Math.trunc(y/400)-32045;let jh=jdn-1948439;let d=Math.trunc(jh/10631);let s=jh%10631;let ts=Math.trunc((s-1)/354);let ht=(s-1)%354;let k=Math.trunc((11*ts+3)/30);if(ht>=k){ht-=k;}let th=d*30+ts+1;let b;if(ht<30)b=1;else if(ht<59)b=2;else if(ht<89)b=3;else if(ht<118)b=4;else if(ht<148)b=5;else if(ht<177)b=6;else if(ht<207)b=7;else if(ht<236)b=8;else if(ht<266)b=9;else if(ht<295)b=10;else if(ht<325)b=11;else b=12;const ab=[0,0,30,59,89,118,148,177,207,236,266,295,325];let t=ht-ab[b]+1;hasilKonversiM_H.innerHTML=`<div class="card sholat-list"><div class="row"><span>a</span><span>${a}</span></div><div class="row"><span>y</span><span>${y}</span></div><div class="row"><span>m</span><span>${m}</span></div><div class="row"><span>JDN</span><span>${jdn}</span></div><div class="row"><span>jh</span><span>${jh}</span></div><div class="row"><span>daur</span><span>${d}</span></div><div class="row"><span>Sisa Hari</span><span>${s}</span></div><div class="row"><span>Tahun Sisa</span><span>${ts}</span></div><div class="row"><span>kabisat</span><span>${k}</span></div><div class="row"><span>h-Tahun</span><span>${ht}</span></div><div class="row"><span>bulan</span><span>${mN[b]}</span></div><div class="row"><span>tglH</span><span>${t}</span></div><div class="poinHasilHisab"><div><span>${v1} ${mM[v2]} ${v3}</span></div><div><span>${t} ${mN[b]} ${th}</span></div></div></div>`;};}



if (btnBackToKonversiM_H) {
  btnBackToKonversiM_H.onclick = () => {
    contentKonversiM_H.classList.remove("hidden");
    panelHasilKonversiM_H.classList.add("hidden");
  };
}
/* ===============================
   HISAB WAKTU SHOLAT
================================ */

const btnProsesWaktuSholat = document.getElementById("btnProsesWaktuSholat");
const panelHasilHisabSholat = document.getElementById("panelHasilHisabSholat");
const btnBackToHitungSholat = document.getElementById("btnBackToHitungSholat");
const hasilHisabWaktuSholat = document.getElementById("hasilHisabWaktuSholat");

if (btnProsesWaktuSholat) {
  btnProsesWaktuSholat.onclick = () => {
    panelInputSholat.classList.add("hidden");
    panelHasilHisabSholat.classList.remove("hidden");

    // =====================
    // INPUT DATA
    // =====================
    const tahun = parseInt(document.getElementById('inputTahun').value) || 2026;
    const bulan = parseInt(document.getElementById('inputBulan').value) || 1;
    const tanggal = parseInt(document.getElementById('inputTanggal').value) || 18;
    const zonaWaktu = 7;
    
    const φ = lokasi.lat;
    const λ = lokasi.lon;
    
    const φKaaba = 21.4225;
    const λKaaba = 39.8262;
    
    const iht = document.getElementById('ihtiyatSholat').value;
    const ihtiyat = iht / 60;
    
    // =====================
    // FUNGSI BANTU
    // =====================
    const d2r = d => d * Math.PI / 180;
    const r2d = r => r * 180 / Math.PI;
    
    const toDMS = x => {
      const sign = x < 0 ? '-' : '';
      x = Math.abs(x);
      const d = Math.floor(x);
      const m = Math.floor((x - d) * 60);
      const s = ((x - d - m/60) * 3600).toFixed(1);
      return `${sign}${d}° ${m}′ ${s}″`;
    };
    
    const toHMS = x => {
      x = (x + 24) % 24;
      const h = Math.floor(x);
      const m = Math.floor((x - h) * 60);
      const s = Math.round(((x - h) * 60 - m) * 60);
      return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    };
    
    function menitKeMS(x){
    const sign = x < 0 ? '−' : '';
    x = Math.abs(x);

    const m = Math.floor(x);
    const s = ((x - m) * 60).toFixed(1);

    return `${sign}${m}′ ${s}″`;
    }
    // =====================
    // HITUNGAN
    // =====================
    let y = tahun;
    let m = bulan;
    if (m <= 2) { y--; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + tanggal + B - 1524.5;
    
    const T = (JD - 2451545) / 36525;
    const L0 = (280.46646 + 36000.76983 * T) % 360;
    const M = 357.52911 + 35999.05029 * T;
    const C = (1.914602 - 0.004817 * T) * Math.sin(d2r(M)) + 0.019993 * Math.sin(d2r(2 * M));
    const λ_matahari = L0 + C;
    const ε = 23.439291 - 0.0130042 * T;
    const δ = r2d(Math.asin(Math.sin(d2r(ε)) * Math.sin(d2r(λ_matahari))));
    const E = 4 * r2d(Math.tan(d2r(ε/2))**2 * Math.sin(d2r(2*L0)) - 2 * 0.016708 * Math.sin(d2r(M)));
    const zawal = 12 + zonaWaktu - (λ / 15) - (E / 60);
    
    const hitungBusur = (h) => {
      const pembilang = Math.sin(d2r(h)) - Math.sin(d2r(φ)) * Math.sin(d2r(δ));
      const penyebut = Math.cos(d2r(φ)) * Math.cos(d2r(δ));
      const arg = pembilang / penyebut;
      
      if (arg <= -1) return 12;
      if (arg >= 1) return 0;
      
      return r2d(Math.acos(arg)) / 15;
    };
    
    const tMaghrib = hitungBusur(-0.833);
    const tIsya = hitungBusur(-18);
    const tSubuh = hitungBusur(-20);
    const tTerbit = hitungBusur(-0.833);
    const tDhuha = hitungBusur(4.5);
    
    const z = Math.tan(d2r(Math.abs(φ - δ)));
    const hAshar = r2d(Math.atan(1 / (1 + z)));
    const tAshar = hitungBusur(hAshar);
    
    // =====================
    // WAKTU SHOLAT 
    // =====================
    const subuh = zawal - tSubuh + ihtiyat;
    const terbit = zawal - tTerbit - ihtiyat;
    const dhuha = zawal - tDhuha + ihtiyat;
    const dzuhur = zawal + ihtiyat;
    const ashar = zawal + tAshar + ihtiyat;
    const maghrib = zawal + tMaghrib + ihtiyat;
    const isya = zawal + tIsya + ihtiyat;
    
    // Nishfu Qaus Lail
    let subuhAdj = zawal - tSubuh;
    if (subuhAdj < maghrib) subuhAdj += 24;
    const nishfuLail = ((maghrib + subuhAdj) / 2) % 24;
    
    // Arah Kiblat
    const Δλ = λKaaba - λ;
    const arahQiblat = r2d(
      Math.atan2(
        Math.sin(d2r(Δλ)),
        Math.cos(d2r(φ)) * Math.tan(d2r(φKaaba)) - 
        Math.sin(d2r(φ)) * Math.cos(d2r(Δλ))
      )
    );
    const arahQiblatNorm = (arahQiblat + 360) % 360;
    
    // =====================
    // OUTPUT
    // =====================// =====================
// OUTPUT DALAM DIV TERPISAH
// =====================
hasilHisabWaktuSholat.innerHTML = `

<!-- DIV 1: DATA DASAR -->
<div class="card sholat-list">
  
  <div class="row">
    <span>Tanggal (d-m-y)</span>
    <span>${tanggal}-${bulan}-${tahun}</span>
  </div>
  <div class="row">
    <span>Arudh Balad (φ)</span>
    <span>${toDMS(φ)}</span>
  </div>
  <div class="row">
    <span>Thul Balad (λ)</span>
    <span>${toDMS(λ)}</span>
  </div>
  <div class="row">
    <span>Ihtiyath (+WS)</span>
    <span>${toHMS(ihtiyat)}</span>
  </div>
  <div class="row">
    <span>Zaman Julian (T)</span>
    <span>${T.toFixed(8)}</span>
  </div>
  
  <div class="row">
    <span>Julian Day (JD)</span>
    <span>${JD.toFixed(6)}</span>
  </div>
  <div class="row">
    <span>Thul Syamsi Wasithi (L₀)</span>
    <span>${toDMS(L0)}</span>
  </div>
  
  <div class="row">
    <span>Anomali Wasithi (M)</span>
    <span>${toDMS(M)}</span>
  </div>
  
  <div class="row">
    <span>Khosshah Syamsi (C)</span>
    <span>${toDMS(C)}</span>
  </div>
  
  <div class="row">
    <span>Thul Haqiqi (λ_Matahari)</span>
    <span>${toDMS(λ_matahari)}</span>
  </div>

  <div class="row">
    <span>Mail Syamsi (ε)</span>
    <span>${toDMS(ε)}</span>
  </div>
  
  <div class="row">
    <span>Mail Haqiqi (δ)</span>
    <span>${toDMS(δ)}</span>
  </div>
  
  <div class="row">
    <span>Daqoiq Tafawut (E)</span>
    <span>${toHMS(E)}</span>
  </div>
  <div class="row">
  <span>Daqāʾiq Tafāwut (E)</span>
  <span>${menitKeMS(E)}</span>
</div>
  <div class="row">
    <span>Zawal Syamsi (Dzuhur)</span>
    <span>${toHMS(zawal)}</span>
  </div>
</div>

<!-- DIV 4: BUSUR-BUSUR -->
<div class="card sholat-list">
  <div class="row">
    <span>Nishfu Qaus Nahr (Zawal -> Maghrib)</span>
    <span>${toHMS(tMaghrib)}</span>
  </div>
  <div class="row">
    <span>Nishfu Qaus Lail (M <--> S) ÷2 WIB</span>
    <span>${toHMS(nishfuLail)}</span>
  </div>
  <div class="row">
    <span>Qaus Isya (Zawal -> Isya)</span>
    <span>${toHMS(tIsya)}</span>
  </div>
  
  <div class="row">
    <span>Qaus Subuh (Subuh -> Zawal)</span>
    <span>${toHMS(tSubuh)}</span>
  </div>
  
  <div class="row">
    <span>Budul Qutr --> (Irtfa Ashar)</span>
    <span>${toDMS(hAshar)}</span>
  </div>
  
  <div class="row">
    <span>Qaus Ashar (Zawal -> Ashar)</span>
    <span>${toHMS(tAshar)}</span>
  </div>
</div>

<!-- DIV 5: WAKTU SHOLAT -->
<div class="card sholat-list">
  <div class="row">
    <span>Subuh</span>
    <span>${toHMS(subuh)}</span>
  </div>
  
  <div class="row">
    <span>Terbit</span>
    <span>${toHMS(terbit)}</span>
  </div>
  
  <div class="row">
    <span>Dhuha</span>
    <span>${toHMS(dhuha)}</span>
  </div>
  
  <div class="row">
    <span>Dzuhur</span>
    <span>${toHMS(dzuhur)}</span>
  </div>
  
  <div class="row">
    <span>Ashar</span>
    <span>${toHMS(ashar)}</span>
  </div>
  
  <div class="row">
    <span>Maghrib</span>
    <span>${toHMS(maghrib)}</span>
  </div>
  
  <div class="row">
    <span>Isya</span>
    <span>${toHMS(isya)}</span>
  </div>
  
</div>

<!-- DIV 6: ARAH KIBLAT -->
<div class="card sholat-list">
  <div class="row">
    <span>Lintang Ka'bah (φ)</span>
    <span>${toDMS(φKaaba, true)}</span>
  </div>
  
  <div class="row">
    <span>Bujur Ka'bah (λ)</span>
    <span>${toDMS(λKaaba)}</span>
  </div>
  
  <div class="row">
    <span>Selisih Bujur (Δλ)</span>
    <span>${toDMS(Δλ)}</span>
  </div>
  
  <div class="row">
    <span>Arah Kiblat</span>
    <span>${toDMS(arahQiblatNorm)} dari Utara</span>
  </div>
  
  <div class="row">
    <span>Azimuth Ka'bah</span>
    <span>${arahQiblatNorm.toFixed(2)}°</span>
  </div>
</div>

`;
    
  };
}

if (btnBackToHitungSholat) {
  btnBackToHitungSholat.onclick = () => {
    panelInputSholat.classList.remove("hidden");
    panelHasilHisabSholat.classList.add("hidden");
  };
}

/* ===============================
   HISAB AWAL BULAN HIJRIYAH
================================ */
if (btnProsesHisab) {
  btnProsesHisab.onclick = () => {
  const koorlong = lokasi.lon;
  const koorlat = lokasi.lat;
  
let tahunmajmuah = document.querySelector("#tahunmajmuah").value; let totaltahunmajmuah =  parseFloat(tahunmajmuah); 

const dataMajmuah = [
  [1410, 161.900], [1420, 33.983], [1430, 74.067], [1440, 114.150], [1450, 154.233], [1460, 26.317], [1470, 66.400], [1480, 106.483], 
  [1490, 146.566], [1500, 18.649], [1510, 58.732], [1520, 98.815], [1530, 138.898], [1540, 10.981], [1550, 51.064]]; 
const dataHissohSinin = [
  [1410, 197.550], [1420, 278.050], [1430, 358.550], [1440, 79.050], [1450, 159.550], [1460, 240.050], [1470, 320.550], [1480, 41.050], 
  [1490, 121.550], [1500, 202.050], [1510, 282.550], [1520, 3.050], [1530, 83.550], [1540, 164.050], [1550, 244.550]];
const dataWasatSinin = [
  [1410, 162.000], [1420, 54.800], [1430, 307.600], [1440, 200.400], [1450, 93.200], [1460, 346.000], [1470, 238.800], [1480, 131.600], 
  [1490, 24.400], [1500, 277.200], [1510, 170.000], [1520, 62.800], [1530, 315.600], [1540, 208.400], [1550, 101.200]];
const dataKhosohSinin = [
  [1410, 322.217], [1420, 180.217], [1430, 38.217], [1440, 256.217], [1450, 114.217], [1460, 332.217], [1470, 190.217], [1480, 48.217], 
  [1490, 266.217], [1500, 124.217], [1510, 342.217], [1520, 3.050], [1530, 83.550], [1540, 164.050], [1550, 244.550]];
const dataMarkazSinin = [
  [1410, 59.833], [1420, 312.500], [1430, 205.167], [1440, 97.833], [1450, 350.500], [1460, 243.167], [1470, 135.833], [1480, 28.500], 
  [1490, 281.167], [1500, 173.833], [1510, 66.500], [1520, 319.167], [1530, 211.834], [1540, 104.501], [1550, 357.168]];

let alamahsininmajmuah = dataMajmuah.find(([batas]) => tahunmajmuah <= batas)?.[1] || 0;
let hissohsininmajmuah = dataHissohSinin.find(([batas]) => tahunmajmuah <= batas)?.[1] || 0;
let wasatsininmajmuah = dataWasatSinin.find(([batas]) => tahunmajmuah <= batas)?.[1] || 0;
let khosohsininmajmuah = dataKhosohSinin.find(([batas]) => tahunmajmuah <= batas)?.[1] || 0;
let markazsininmajmuah = dataMarkazSinin.find(([batas]) => tahunmajmuah <= batas)?.[1] || 0;

let tahunmabsutoh = document.querySelector("#tahunmabsutoh").value; let totaltahunmabsutoh = parseFloat(tahunmabsutoh);

const dataAlamahSininMabsutoh = [
  [1, 104.800], [2, 41.617], [3, 146.417], [4, 83.233], [5, 20.033], [6, 124.850], [7, 61.650], [8, 166.467], [9, 103.267], [10, 40.083]];
const dataHissohSininMabsutoh = [
  [1, 8.050], [2, 16.100], [3, 24.150], [4, 32.200], [5, 40.250], [6, 48.300], [7, 56.350], [8, 64.400], [9, 72.450], [10, 80.500]];
const dataWasatSininMabsutoh = [
  [1, 349.267], [2, 338.567], [3, 327.833], [4, 317.117], [5, 306.400], [6, 295.683], [7, 284.967], [8, 274.233], [9, 263.517], [10, 252.800]]; 
const dataKhosohSininMabsutoh = [
  [1, 309.800], [2, 259.600], [3, 209.400], [4, 159.200], [5, 109.000], [6, 58.800], [7, 8.600], [8, 318.400], [9, 268.200], [10, 218.000]];
const dataMarkazSininMabsutoh = [
  [1, 349.267], [2, 338.533], [3, 327.800], [4, 317.067], [5, 306.333], [6, 295.600], [7, 284.867], [8, 274.133], [9, 263.400], [10, 252.667]];

let alamahsininmabsutoh = dataAlamahSininMabsutoh.find(([batas]) => totaltahunmabsutoh <= batas)?.[1] || "0"; 
let hissohsininmabsutoh = dataHissohSininMabsutoh.find(([batas]) => totaltahunmabsutoh <= batas)?.[1] || "0"; 
let wasatsininmabsutoh = dataWasatSininMabsutoh.find(([batas]) => totaltahunmabsutoh <= batas)?.[1] || "0";
let khosohsininmabsutoh = dataKhosohSininMabsutoh.find(([batas]) => totaltahunmabsutoh <= batas)?.[1] || "0";
let markazsininmabsutoh = dataMarkazSininMabsutoh.find(([batas]) => totaltahunmabsutoh <= batas)?.[1] || "0";

let bulanhijriyah = document.querySelector("#bulanhijriyah").value; let totalbulan = parseFloat(bulanhijriyah);

const dataAlamah = [[1, 68.067], [2, 0.000], [3, 36.733], [4, 73.467], [5, 110.200], [6, 146.933], [7, 15.667], [8, 52.400], [9, 89.133], [10, 125.867], [11, 162.600], [12, 31.333]];
const dataHissoh = [[1, 337.383], [2, 0.000], [3, 30.667], [4, 61.333], [5, 92.017], [6, 122.683], [7, 153.350], [8, 184.017], [9, 214.700], [10, 245.367], [11, 276.050], [12, 306.717]];
const dataWasat = [[1, 320.167], [2, 0.000], [3, 29.100], [4, 58.217], [5, 87.317], [6, 116.433], [7, 145.533], [8, 174.633], [9, 203.750], [10, 232.850], [11, 261.950], [12, 291.067]];
const dataKhosoh = [[1, 283.983], [2, 0.000], [3, 25.817], [4, 51.633], [5, 77.433], [6, 103.267], [7, 129.083], [8, 154.900], [9, 180.717], [10, 206.533], [11, 232.350], [12, 258.167]];
const dataMarkaz = [[1, 320.167], [2, 0.000], [3, 29.100], [4, 58.217], [5, 87.317], [6, 116.433], [7, 145.533], [8, 174.633], [9, 203.750], [10, 232.850], [11, 261.950], [12, 291.067]];

let alamahbulan = dataAlamah.find(([batas]) => totalbulan <= batas)?.[1] || "0";
let hissohbulan = dataHissoh.find(([batas]) => totalbulan <= batas)?.[1] || "0";
let wasatbulan = dataWasat.find(([batas]) => totalbulan <= batas)?.[1] || "0";
let khosohbulan = dataKhosoh.find(([batas]) => totalbulan <= batas)?.[1] || "0";
let markazbulan = dataMarkaz.find(([batas]) => totalbulan <= batas)?.[1] || "0";

let totalAlamah = alamahsininmajmuah + alamahsininmabsutoh + alamahbulan;
let hasilAkhirAlamah = totalAlamah >= 168 ? totalAlamah - 168 : totalAlamah -0;
let hasilAkhirAlamah2 = hasilAkhirAlamah >= 168 ? hasilAkhirAlamah - 168 : hasilAkhirAlamah -0;
let totalHissoh = hissohsininmajmuah + hissohsininmabsutoh + hissohbulan;
let hasilAkhirHissoh = totalHissoh >= 360 ? totalHissoh - 360 : totalHissoh -0;
let hasilAkhirHissoh2 = hasilAkhirHissoh >= 360 ? hasilAkhirHissoh - 360 : hasilAkhirHissoh -0;         

function hitungHasil(total, batas) {
return total >= batas ? total - batas : total;}
let totalWasat123 = wasatsininmajmuah + wasatsininmabsutoh + wasatbulan;
let hasilAkhirWasat = hitungHasil(totalWasat123, 360); 
let hasilAkhirWasat2 = hitungHasil(hasilAkhirWasat, 360);

let totalKhosoh123 = khosohsininmajmuah + khosohsininmabsutoh + khosohbulan;
let hasilAkhirKhosoh = hitungHasil(totalKhosoh123, 360);
let hasilAkhirKhosoh2 = hitungHasil(hasilAkhirKhosoh, 360);
let totalMarkaz123 = markazsininmajmuah + markazsininmabsutoh + markazbulan;
let hasilAkhirMarkaz = hitungHasil(totalMarkaz123, 360);
let hasilAkhirMarkaz2 = hitungHasil(hasilAkhirMarkaz, 360);

let hasilAkhirAlamah3 = hasilAkhirAlamah2.toFixed(3);
let hasilAkhirHissoh3 = hasilAkhirHissoh2.toFixed(3);
let hasilAkhirWasat3 = hasilAkhirWasat2.toFixed(3);
let hasilAkhirKhosoh3 = Math.round(hasilAkhirKhosoh2);
let hasilAkhirMarkaz3 = Math.round(hasilAkhirMarkaz2); 


let tahunYangDimaksud = totaltahunmajmuah + totaltahunmabsutoh + (totalbulan <= 1 ? 1 : 0);
const bulanList = ["Muharom", "Sopar", "Robi'ul Awal", "Robi'ust Stani", "Jumadil Awal", "Jumadist Stani", "Rojab", "Sya'ban", "Romadhon", "Syawal", "Dzul Qo'dah", "Dzul Hijjah"];

let bulanYangDimaksud = bulanList[totalbulan - 1] || "Invalid";
  
const lookupTadilKhosoh = [
  4.983, 4.900, 4.833, 4.750, 4.667, 4.583, 4.500, 4.417, 4.333, 4.250, // 0 - 9
  4.183, 4.100, 4.017, 3.933, 3.850, 3.783, 3.717, 3.633, 3.550, 3.467, // 10 - 19
  3.400, 3.317, 3.250, 3.183, 3.117, 3.050, 2.967, 2.900, 2.817, 2.750, // 20 - 29
  2.683, 2.600, 2.533, 2.467, 2.400, 2.333, 2.250, 2.183, 2.117, 2.050, // 30 - 39
  1.983, 1.917, 1.850, 1.783, 1.717, 1.667, 1.600, 1.550, 1.483, 1.433, // 40 - 49
  1.383, 1.317, 1.267, 1.217, 1.167, 1.117, 1.067, 1.017, 0.967, 0.917, // 50 - 59
  0.867, 0.817, 0.783, 0.733, 0.683, 0.633, 0.600, 0.567, 0.533, 0.483, // 60 - 69
  0.450, 0.433, 0.417, 0.383, 0.350, 0.300, 0.283, 0.267, 0.250, 0.217, // 70 - 79
  0.183, 0.150, 0.133, 0.117, 0.100, 0.083, 0.067, 0.050, 0.050, 0.033, // 80 - 89
  0.033, 0.033, 0.017, 0.017, 0.000, 0.000, 0.000, 0.000, 0.017, 0.017, // 90 - 99
  0.033, 0.033, 0.050, 0.067, 0.083, 0.100, 0.117, 0.133, 0.150, 0.167, // 100 - 109
  0.183, 0.200, 0.250, 0.267, 0.300, 0.317, 0.350, 0.383, 0.417, 0.450, // 110 - 119
  0.500, 0.533, 0.583, 0.617, 0.667, 0.717, 0.767, 0.817, 0.867, 0.917, // 120 - 129
  0.967, 1.033, 1.083, 1.150, 1.200, 1.250, 1.317, 1.383, 1.450, 1.517, // 130 - 139
  1.583, 1.650, 1.717, 1.783, 1.850, 1.933, 2.000, 2.083, 2.150, 2.233, // 140 - 149
  2.317, 2.383, 2.450, 2.533, 2.617, 2.717, 2.800, 2.950, 2.967, 3.050, // 150 - 159
  3.133, 3.217, 3.317, 3.400, 3.483, 3.583, 3.667, 3.750, 3.850, 3.933, // 160 - 169
  4.033, 4.117, 4.200, 4.283, 4.367, 4.450, 4.550, 4.650, 4.767, 4.867, // 170 - 179
  4.983, 5.083, 5.183, 5.267, 5.367, 5.450, 5.550, 5.650, 5.750, 5.833, // 180 - 189
  5.933, 6.033, 6.133, 6.217, 6.317, 6.400, 6.500, 6.583, 6.667, 6.750, // 190 - 199
  6.833, 6.933, 7.017, 7.100, 7.183, 7.267, 7.350, 7.433, 7.517, 7.600, // 200 - 209
  7.683, 7.767, 7.833, 7.917, 7.983, 8.050, 8.133, 8.200, 8.283, 8.350, // 210 - 219
  8.417, 8.483, 8.550, 8.617, 8.683, 8.733, 8.800, 8.850, 8.900, 8.967, // 220 - 229
  9.017, 9.067, 9.117, 9.167, 9.217, 9.267, 9.317, 9.350, 9.383, 9.433, // 230 - 239
  9.483, 9.517, 9.550, 9.600, 9.633, 9.667, 9.683, 9.700, 9.733, 9.767, // 240 - 249
  9.800, 9.817, 9.833, 9.850, 9.867, 9.883, 9.900, 9.917, 9.933, 9.950, // 250 - 259
  9.950, 9.967, 9.967, 9.983, 9.983, 10.000, 10.000, 10.000, 9.983, 9.983, // 260 - 269
  9.983, 9.983, 9.967, 9.950, 9.950, 9.933, 9.900, 9.883, 9.867, 9.833, // 270 - 279
  9.800, 9.783, 9.767, 9.733, 9.717, 9.683, 9.650, 9.617, 9.583, 9.550, // 280 - 289
  9.517, 9.483, 9.450, 9.417, 9.383, 9.333, 9.283, 9.250, 9.217, 9.167, // 290 - 299
  9.117, 9.067, 9.017, 8.967, 8.917, 8.867, 8.817, 8.767, 8.717, 8.667, // 300 - 309
  8.600, 8.550, 8.483, 8.417, 8.367, 8.300, 8.250, 8.183, 8.117, 8.050, // 310 - 319
  7.983, 7.917, 7.850, 7.783, 7.717, 7.650, 7.583, 7.517, 7.450, 7.383, // 320 - 329
  7.300, 7.233, 7.150, 7.083, 7.000, 6.933, 6.867, 6.800, 6.717, 6.650, // 330 - 339
  6.583, 6.500, 6.400, 6.350, 6.267, 6.183, 6.100, 6.017, 5.950, 5.867, // 340 - 349
  5.783, 5.700, 5.617, 5.550, 5.467, 5.383, 5.300, 5.217, 5.150, 5.067  // 350 - 359
];
let index = Math.ceil(hasilAkhirKhosoh3);if (index < 0) index = 0;if (index >= lookupTadilKhosoh.length) index = lookupTadilKhosoh.length - 1;let tadilkhosoh = lookupTadilKhosoh[index];
  
const lookupTadilMarkaz = [
  1.933, 1.983, 2.017, 2.050, 2.083, 2.100, 2.133, 2.167, 2.200, 2.233, // 0 - 9
  2.267, 2.300, 2.317, 2.350, 2.383, 2.417, 2.450, 2.483, 2.517, 2.550, // 10 - 19
  2.583, 2.617, 2.650, 2.667, 2.700, 2.733, 2.767, 2.800, 2.833, 2.850, // 20 - 29
  2.883, 2.917, 2.950, 2.967, 2.983, 3.017, 3.050, 3.083, 3.117, 3.133, // 30 - 39
  3.150, 3.167, 3.200, 3.217, 3.250, 3.267, 3.283, 3.317, 3.333, 3.350, // 40 - 49
  3.383, 3.400, 3.433, 3.450, 3.467, 3.500, 3.517, 3.533, 3.550, 3.567, // 50 - 59
  3.583, 3.600, 3.617, 3.633, 3.650, 3.667, 3.683, 3.683, 3.700, 3.717, // 60 - 69
  3.733, 3.750, 3.767, 3.767, 3.783, 3.800, 3.800, 3.800, 3.817, 3.817, // 70 - 79
  3.833, 3.833, 3.850, 3.850, 3.850, 3.867, 3.867, 3.867, 3.867, 3.867, // 80 - 89
  3.867, 3.867, 3.867, 3.867, 3.867, 3.867, 3.867, 3.867, 3.867, 3.867, // 90 - 99
  3.867, 3.850, 3.850, 3.850, 3.833, 3.833, 3.817, 3.800, 3.800, 3.783, // 100 - 109
  3.783, 3.767, 3.750, 3.750, 3.733, 3.717, 3.717, 3.700, 3.683, 3.660, // 110 - 119
  3.650, 3.633, 3.617, 3.600, 3.583, 3.567, 3.550, 3.533, 3.500, 3.483, // 120 - 129
  3.467, 3.450, 3.417, 3.400, 3.367, 3.350, 3.317, 3.300, 3.283, 3.250, // 130 - 139
  3.233, 3.200, 3.167, 3.133, 3.117, 3.083, 3.050, 3.017, 2.983, 2.950, // 140 - 149
  2.933, 2.900, 2.867, 2.850, 2.817, 2.783, 2.750, 2.717, 2.700, 2.667, // 150 - 159
  2.633, 2.600, 2.567, 2.533, 2.500, 2.467, 2.433, 2.383, 2.350, 2.317, // 160 - 169
  2.283, 2.250, 2.217, 2.183, 2.150, 2.117, 2.083, 2.050, 2.017, 1.983, // 170 - 179
  1.933, 1.900, 1.883, 1.850, 1.800, 1.767, 1.733, 1.700, 1.667, 1.633, // 180 - 189
  1.600, 1.567, 1.533, 1.483, 1.450, 1.417, 1.383, 1.350, 1.317, 1.283, // 190 - 199
  1.250, 1.217, 1.183, 1.167, 1.133, 1.100, 1.067, 1.033, 1.000, 0.967, // 200 - 209
  0.933, 0.900, 0.867, 0.833, 0.800, 0.783, 0.750, 0.717, 0.700, 0.667, // 210 - 219
  0.650, 0.617, 0.600, 0.583, 0.550, 0.533, 0.500, 0.483, 0.467, 0.433, // 220 - 229
  0.417, 0.400, 0.383, 0.350, 0.333, 0.317, 0.300, 0.283, 0.267, 0.250, // 230 - 239
  0.233, 0.217, 0.200, 0.183, 0.167, 0.150, 0.150, 0.133, 0.117, 0.117, // 240 - 249
  0.100, 0.100, 0.083, 0.067, 0.067, 0.050, 0.050, 0.033, 0.033, 0.017, // 250 - 259
  0.017, 0.017, 0.017, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, // 260 - 269
  0.000, 0.000, 0.000, 0.000, 0.017, 0.017, 0.017, 0.033, 0.033, 0.033, // 270 - 279
  0.050, 0.050, 0.067, 0.067, 0.083, 0.100, 0.100, 0.117, 0.117, 0.133, // 280 - 289
  0.150, 0.150, 0.167, 0.183, 0.200, 0.217, 0.233, 0.250, 0.267, 0.283, // 290 - 209
  0.300, 0.317, 0.333, 0.360, 0.383, 0.400, 0.417, 0.433, 0.467, 0.483, // 300 - 309
  0.500, 0.517, 0.550, 0.567, 0.600, 0.617, 0.633, 0.667, 0.683, 0.717, // 310 - 319
  0.733, 0.767, 0.783, 0.817, 0.833, 0.867, 0.883, 0.917, 0.933, 0.967, // 320 - 329
  1.000, 1.033, 1.067, 1.083, 1.117, 1.150, 1.183, 1.217, 1.233, 1.267, // 330 - 339
  1.300, 1.333, 1.367, 1.383, 1.400, 1.450, 1.483, 1.517, 1.550, 1.583, // 340 - 349
  1.617, 1.650, 1.683, 1.717, 1.750, 1.767, 1.800, 1.833, 1.867, 1.900  // 350 - 359
];
let index2 = Math.ceil(hasilAkhirMarkaz3);if (index2 < 0) index2 = 0;if (index2 >= lookupTadilMarkaz.length) index2 = lookupTadilMarkaz.length - 1;let tadilmarkaz = lookupTadilMarkaz[index2];
  
let buduGoerMuadal = tadilkhosoh + tadilmarkaz; let buduGoerMuadal2 = buduGoerMuadal.toFixed(3); let hasildorob = buduGoerMuadal * 0.08333;let hasildorob2 = hasildorob.toFixed(3);let tadilwasat = tadilmarkaz + hasildorob;let tadilwasat2 = tadilwasat.toFixed(3);let muqowwamsyamsi = hasilAkhirWasat3 - tadilwasat;let muqowwamsyamsi2 = muqowwamsyamsi.toFixed(3);
let mq = muqowwamsyamsi / 30;let mq1 = Math.trunc(mq);
mq1 = Math.min(Math.max(mq1, 0), 12);
const months = ['Al-Haml', 'As-Stuur', 'Al-Jauza', 'As-Syarthon', 'Al-Asad', 'As-Sumbulah', 'Al-Mizan', 'Al-Aqrob', 'Al-Qous', 'Al-Jadyu', 'Ad-Dalwu', 'Al-Huut', 'Al-Haml'
];
let mq2 = months[mq1]; let mq3 = (mq1 <= 2) ? 'Utara' : (mq1 <= 8 ? 'Selatan' : 'Utara');let mq3a = (mq1 <= 2) ? 'Selatan' : (mq1 <= 8 ? 'Utara' : 'Selatan');let mq4 = Math.round(muqowwamsyamsi);

const lookupTadilayyam = [
  { min: 355, value: 0.050 }, { min: 350, value: 0.050 }, { min: 345, value: 0.033 },
  { min: 340, value: 0.017 }, { min: 335, value: 0.017 }, { min: 330, value: 0.000 },
  { min: 325, value: 0.000 }, { min: 320, value: 0.000 }, { min: 315, value: 0.000 },
  { min: 310, value: 0.017 }, { min: 305, value: 0.017 }, { min: 300, value: 0.033 },
  { min: 295, value: 0.050 }, { min: 290, value: 0.067 }, { min: 285, value: 0.083 },
  { min: 280, value: 0.100 }, { min: 275, value: 0.117 }, { min: 270, value: 0.150 },
  { min: 265, value: 0.167 }, { min: 260, value: 0.183 }, { min: 255, value: 0.217 },
  { min: 250, value: 0.233 }, { min: 245, value: 0.250 }, { min: 240, value: 0.267 },
  { min: 235, value: 0.267 }, { min: 230, value: 0.283 }, { min: 225, value: 0.283 },
  { min: 220, value: 0.283 }, { min: 215, value: 0.283 }, { min: 210, value: 0.283 },
  { min: 205, value: 0.267 }, { min: 200, value: 0.267 }, { min: 195, value: 0.250 },
  { min: 190, value: 0.233 }, { min: 185, value: 0.217 }, { min: 180, value: 0.217 },
  { min: 175, value: 0.200 }, { min: 170, value: 0.183 }, { min: 165, value: 0.187 },
  { min: 160, value: 0.150 }, { min: 155, value: 0.133 }, { min: 150, value: 0.117 },
  { min: 145, value: 0.117 }, { min: 140, value: 0.110 }, { min: 135, value: 0.100 },
  { min: 130, value: 0.100 }, { min: 125, value: 0.083 }, { min: 120, value: 0.100 },
  { min: 115, value: 0.100 }, { min: 110, value: 0.100 }, { min: 105, value: 0.117 },
  { min: 100, value: 0.117 }, { min: 95, value: 0.133 }, { min: 90, value: 0.133 },
  { min: 85, value: 0.150 }, { min: 80, value: 0.150 }, { min: 75, value: 0.167 },
  { min: 70, value: 0.167 }, { min: 65, value: 0.183 }, { min: 60, value: 0.183 },
  { min: 55, value: 0.183 }, { min: 50, value: 0.183 }, { min: 45, value: 0.183 },
  { min: 40, value: 0.167 }, { min: 35, value: 0.167 }, { min: 30, value: 0.150 },
  { min: 25, value: 0.150 }, { min: 20, value: 0.133 }, { min: 15, value: 0.117 },
  { min: 10, value: 0.100 }, { min: 5, value: 0.083 }, { min: 0, value: 0.067 }
];
let tadilayyam = lookupTadilayyam.find(item => mq4 >= item.min)?.value ?? 0;let budumuadal = buduGoerMuadal - tadilayyam;let budumuadal2 = budumuadal.toFixed(3);let thulsyamsi = muqowwamsyamsi - budumuadal;let thulsyamsi2 = thulsyamsi.toFixed(3);

const lookupHissohsaah = [
  { min: 355, value: 2.200 }, { min: 350, value: 2.200 }, { min: 345, value: 2.200 },
  { min: 340, value: 2.183 }, { min: 335, value: 2.167 }, { min: 330, value: 2.150 },
  { min: 325, value: 2.133 }, { min: 320, value: 2.117 }, { min: 315, value: 2.100 },
  { min: 310, value: 2.100 }, { min: 305, value: 2.067 }, { min: 300, value: 2.050 },
  { min: 295, value: 2.033 }, { min: 290, value: 2.017 }, { min: 285, value: 2.000 },
  { min: 280, value: 1.983 }, { min: 275, value: 1.983 }, { min: 270, value: 1.967 },
  { min: 265, value: 1.933 }, { min: 260, value: 1.917 }, { min: 255, value: 1.900 },
  { min: 250, value: 1.883 }, { min: 245, value: 1.867 }, { min: 240, value: 1.850 },
  { min: 235, value: 1.833 }, { min: 230, value: 1.800 }, { min: 225, value: 1.800 },
  { min: 220, value: 1.783 }, { min: 215, value: 1.767 }, { min: 210, value: 1.767 },
  { min: 205, value: 1.750 }, { min: 200, value: 1.750 }, { min: 195, value: 1.750 },
  { min: 190, value: 1.750 }, { min: 185, value: 1.750 }, { min: 180, value: 1.750 },
  { min: 175, value: 1.750 }, { min: 170, value: 1.767 }, { min: 165, value: 1.767 },
  { min: 160, value: 1.783 }, { min: 155, value: 1.800 }, { min: 150, value: 1.817 },
  { min: 145, value: 1.833 }, { min: 140, value: 1.833 }, { min: 135, value: 1.867 },
  { min: 130, value: 1.883 }, { min: 125, value: 1.900 }, { min: 120, value: 1.917 },
  { min: 115, value: 1.933 }, { min: 110, value: 1.950 }, { min: 105, value: 1.983 },
  { min: 100, value: 2.017 }, { min: 95, value: 2.033 }, { min: 90, value: 2.050 },
  { min: 85, value: 2.067 }, { min: 80, value: 2.083 }, { min: 75, value: 2.100 },
  { min: 70, value: 2.117 }, { min: 65, value: 2.133 }, { min: 60, value: 2.150 },
  { min: 55, value: 2.167 }, { min: 50, value: 2.167 }, { min: 45, value: 2.167 },
  { min: 40, value: 2.183 }, { min: 35, value: 2.200 }, { min: 30, value: 2.200 },
  { min: 25, value: 2.200 }, { min: 20, value: 2.200 }, { min: 15, value: 2.217 },
  { min: 10, value: 2.217 }, { min: 5, value: 2.217 }, { min: 0, value: 2.217 }
];
let hissohsaah = lookupHissohsaah.find(range => hasilAkhirKhosoh3 >= range.min).value;
  let tadilalamah = budumuadal * hissohsaah; let tadilalamah2 = tadilalamah.toFixed(3)
  let jkt = hasilAkhirAlamah3 - tadilalamah;
  let jkt2 = jkt <= 0 ? jkt + 168 : jkt;
  let jkt3 = jkt2.toFixed(3);
  let selisihwaktu = Math.abs(koorlong - 106.8272) /15; let selisihwaktu2 = selisihwaktu.toFixed(3)
  let bittatbieq = (jkt2 - selisihwaktu) +1;
  let bittatbieq2 = bittatbieq.toFixed(3);
  let ij = bittatbieq / 24; 
  let ijt = Math.trunc(ij);
  
  const days = ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jum'at"];
  let indexYaqoulijtima = Math.floor(ijt) % 7;
let yaqoulijtima = days[indexYaqoulijtima];
let yaqoulijtima2 = days[(indexYaqoulijtima + 1) % 7];

// Jam 6 dan Jam 12 di koreksi waktu maghri dan zawal
// Hitung Waktu Magrib dan zawal

// KONVERSEI TANGGAL HIJRI -> MASEHI

const tgl = 1;
const bln = totalbulan;
const thn = tahunYangDimaksud;

let tth = thn - 1;
    let daor = Math.trunc(tth / 30);
    let st = tth % 30;
    let jth = daor * 10631;
    let thst = st * 354;

let ak;
    if (st <= 4) ak = 1;
    else if (st <= 6) ak = 2;
    else if (st <= 9) ak = 3;
    else if (st <= 12) ak = 4;
    else if (st <= 15) ak = 5;
    else if (st <= 17) ak = 6;
    else if (st <= 20) ak = 7;
    else if (st <= 23) ak = 8;
    else if (st <= 25) ak = 9;
    else if (st <= 29) ak = 10;
    
    const jhdsMap = { 
        1: 0, 2: 30, 3: 59, 4: 89, 5: 118, 
        6: 148, 7: 177, 8: 207, 9: 236, 
        10: 266, 11: 295, 12: 325 
    };
    
    let jhds = jhdsMap[bln];
    let jhhk = jth + thst + ak + jhds + tgl;
    let jhmk = 227014 + jhhk; 
    // Lanjutan setelah jhmk
let tkt_ttM = jhmk / 365.2425;
let ttM = Math.trunc(tkt_ttM);
let sttm = tkt_ttM - ttM;
let jhp = Math.round(sttm * 365.2425) ;
let thnm = ttM + 1;

let b_masehi;
let b_masehi_nama;
if (jhp <= 31) { b_masehi = 1; b_masehi_nama = "Januari"; }
else if (jhp <= 59) { b_masehi = 2; b_masehi_nama = "Februari"; }
else if (jhp <= 90) { b_masehi = 3; b_masehi_nama = "Maret"; }
else if (jhp <= 120) { b_masehi = 4; b_masehi_nama = "April"; }
else if (jhp <= 151) { b_masehi = 5; b_masehi_nama = "Mei"; }
else if (jhp <= 181) { b_masehi = 6; b_masehi_nama = "Juni"; }
else if (jhp <= 212) { b_masehi = 7; b_masehi_nama = "Juli"; }
else if (jhp <= 243) { b_masehi = 8; b_masehi_nama = "Agustus"; }
else if (jhp <= 273) { b_masehi = 9; b_masehi_nama = "September"; }
else if (jhp <= 304) { b_masehi = 10; b_masehi_nama = "Oktober"; }
else if (jhp <= 334) { b_masehi = 11; b_masehi_nama = "November"; }
else { b_masehi = 12; b_masehi_nama = "Desember"; }

let x_tglmm;
switch(b_masehi) {
    case 1: x_tglmm = 0; break;
    case 2: x_tglmm = 31; break;
    case 3: x_tglmm = 59; break;
    case 4: x_tglmm = 90; break;
    case 5: x_tglmm = 120; break;
    case 6: x_tglmm = 151; break;
    case 7: x_tglmm = 181; break;
    case 8: x_tglmm = 212; break;
    case 9: x_tglmm = 243; break;
    case 10: x_tglmm = 273; break;
    case 11: x_tglmm = 304; break;
    case 12: x_tglmm = 334; break;
    default: x_tglmm = 0;
}
let tglmm = Math.round(jhp - x_tglmm);
let hasilTgl = tglmm === 0 ? 31 : tglmm;

// KOREKSI TANGGAL & PASARAN MASEHI
let tmM = tahunYangDimaksud;
let bmM = totalbulan;
const dataKonversi = {
    1447: {
        1: "20 Juli 2025",
        2: "20 Agustus 2025",
        3: "19 September 2025",
        4: "20 Oktober 2025",
        5: "18 November 2025",
        7: "18 Desember 2025",
        8: "Pahing, 20 Januari 2026",
        9: "Pahing, 19 Februari 2026",
        10: "Legi, 20 Maret 2026",
        11: "Legi, 19 April 2026",
        12: "Kliwon 18 Mei 2026"
    },
    1448: {
        1: "Wage, 16 Juni 2026",
        2: "Wage, 16 Juli 2026",
        3: "Pon, 14 Agustus 2026",
        4: "Pahing, 12 September 2026",
        5: "Pahing, 12 Oktober 2026",
        6: "Pahing, 11 November 2026",
        7: "Legi, 10 Desember 2026",
        8: "Legi, 9 Januari 2027",
        9: "Legi, 8 Februari 2027",
        10: "Legi, 10 Maret 2027",
        11: "Kliwon, 8 April 2027",
        12: "Kliwon 8 Mei 2027"
    }
};

function getTanggalMasehi(tmM, bmM) {
    if (dataKonversi[tmM] && dataKonversi[tmM][bmM]) {
        return dataKonversi[tmM][bmM];
    } else {
        return "No data";
    }
}
let hasilTanggalMasehi = getTanggalMasehi(tmM, bmM);

    const zonaWaktu = 7;
    const φ = lokasi.lat;
    const λ = lokasi.lon;
    
    const d2r = d => d * Math.PI / 180;
    const r2d = r => r * 180 / Math.PI;
    
    const toDMS = x => {
      const sign = x < 0 ? '-' : '';
      x = Math.abs(x);
      const d = Math.floor(x);
      const m = Math.floor((x - d) * 60);
      const s = ((x - d - m/60) * 3600).toFixed(1);
      return `${sign}${d}° ${m}′ ${s}″`;
    };
    
    const toHMS = x => {
      x = (x + 24) % 24;
      const h = Math.floor(x);
      const m = Math.floor((x - h) * 60);
      const s = Math.round(((x - h) * 60 - m) * 60);
      return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    };
    
    function menitKeMS(x){
    const sign = x < 0 ? '−' : '';
    x = Math.abs(x);

    const m = Math.floor(x);
    const s = ((x - m) * 60).toFixed(1);

    return `${sign}${m}′ ${s}″`;
    }

    let y = thnm;
    let m = b_masehi;
    if (m <= 2) { y--; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + hasilTgl + B - 1524.5;
    
    const T = (JD - 2451545) / 36525;
    const L0 = (280.46646 + 36000.76983 * T) % 360;
    const M = 357.52911 + 35999.05029 * T;
    const C = (1.914602 - 0.004817 * T) * Math.sin(d2r(M)) + 0.019993 * Math.sin(d2r(2 * M));
    const λ_matahari = L0 + C;
    const ε = 23.439291 - 0.0130042 * T;
    const δ = r2d(Math.asin(Math.sin(d2r(ε)) * Math.sin(d2r(λ_matahari))));
    const E = 4 * r2d(Math.tan(d2r(ε/2))**2 * Math.sin(d2r(2*L0)) - 2 * 0.016708 * Math.sin(d2r(M)));
    const zawal = 12 + zonaWaktu - (λ / 15) - (E / 60);
    
    const hitungBusur = (h) => {
      const pembilang = Math.sin(d2r(h)) - Math.sin(d2r(φ)) * Math.sin(d2r(δ));
      const penyebut = Math.cos(d2r(φ)) * Math.cos(d2r(δ));
      const arg = pembilang / penyebut;
      
      if (arg <= -1) return 12;
      if (arg >= 1) return 0;
      
      return r2d(Math.acos(arg)) / 15;
    };
    
    const tMaghrib = hitungBusur(-0.833);
    const tIsya = hitungBusur(-18);
    const tSubuh = hitungBusur(-20);
    const tTerbit = hitungBusur(-0.833);
    const tDhuha = hitungBusur(4.5);
    
    const z = Math.tan(d2r(Math.abs(φ - δ)));
    const hAshar = r2d(Math.atan(1 / (1 + z)));
    const tAshar = hitungBusur(hAshar);

    const terbit = zawal - tTerbit;
    const dzh = zawal + (2/6);
    const dzuhur = dzh.toFixed(3);
    const mgb = zawal + tMaghrib + (2/60);
    const maghrib = mgb.toFixed(3);
    const sz = dzuhur - 12;
    const sm = maghrib - 12;
    
let sig = bittatbieq % 24; let sig2 = sig.toFixed(3) 
let siz;
if (sig < sm) {
    siz = sig + 6 + sz;
} else if (sig < dzuhur) {
    siz = sig + 6 + sz;
} else if (sig < 18) {
    siz = sig + 6 + sz;
} else if (sig - 18 < 1) {
    siz = (sig - 18) + 12 + sz ;
} else {
    siz = sig - 18;
} 
let siz2 = siz.toFixed(3);

// Koreksi waktu maghrib dan zawal sampai sini
let mig = 24 - sig; let mig2 = mig.toFixed(3); let irtipa = mig / 2; let irtipa2 = irtipa.toFixed(3);
let mukstulhilal = irtipa * 0.0667; let mukstulhilal2 = mukstulhilal.toFixed(3);
let hs = Math.round(hasilAkhirHissoh2); 
 
 const lookupKamyah = [
  1.933, 1.983, 2.017, 2.050, 2.083, 2.100, 2.133, 2.167, 2.200, 2.233, // 0 - 9
  2.267, 2.300, 2.317, 2.350, 2.383, 2.417, 2.450, 2.483, 2.517, 2.550, // 10 - 19
  2.583, 2.617, 2.650, 2.667, 2.700, 2.733, 2.767, 2.800, 2.833, 2.850, // 20 - 29
  2.883, 2.917, 2.950, 2.967, 2.983, 3.017, 3.050, 3.083, 3.117, 3.133, // 30 - 39
  3.150, 3.167, 3.200, 3.217, 3.250, 3.267, 3.283, 3.317, 3.333, 3.350, // 40 - 49
  3.383, 3.400, 3.433, 3.450, 3.467, 3.500, 3.517, 3.533, 3.550, 3.567, // 50 - 59
  3.583, 3.600, 3.617, 3.633, 3.650, 3.667, 3.683, 3.683, 3.700, 3.717, // 60 - 69
  3.733, 3.750, 3.767, 3.767, 3.783, 3.800, 3.800, 3.800, 3.817, 3.817, // 70 - 79
  3.833, 3.833, 3.850, 3.850, 3.850, 3.867, 3.867, 3.867, 3.867, 3.867, // 80 - 89
  3.867, 3.867, 3.867, 3.867, 3.867, 3.867, 3.867, 3.867, 3.867, 3.867, // 90 - 99
  3.867, 3.850, 3.850, 3.850, 3.883, 3.883, 3.817, 3.800, 3.800, 3.783, // 100 - 109
  3.783, 3.767, 3.750, 3.750, 3.733, 3.717, 3.717, 3.700, 3.683, 3.660, // 110 - 119
  3.650, 3.633, 3.617, 3.600, 3.583, 3.567, 3.550, 3.533, 3.500, 3.483, // 120 - 129
  3.467, 3.450, 3.417, 3.400, 3.367, 3.350, 3.317, 3.300, 3.283, 3.250, // 130 - 139
  3.233, 3.200, 3.167, 3.133, 3.117, 3.083, 3.050, 3.017, 2.983, 2.950, // 140 - 149
  2.933, 2.900, 2.867, 2.850, 2.817, 2.783, 2.750, 2.717, 2.700, 2.667, // 150 - 159
  2.633, 2.600, 2.567, 2.533, 2.500, 2.467, 2.433, 2.383, 2.350, 2.317, // 160 - 169
  2.283, 2.250, 2.217, 2.183, 2.150, 2.117, 2.083, 2.050, 2.017, 1.983, // 170 - 179
  1.933, 1.917, 1.883, 1.850, 1.800, 1.767, 1.733, 1.700, 1.667, 1.633, // 180 - 189
  1.600, 1.567, 1.533, 1.483, 1.450, 1.417, 1.383, 1.350, 1.317, 1.283, // 190 - 199
  1.250, 1.217, 1.183, 1.167, 1.133, 1.100, 1.067, 1.033, 1.000, 0.967, // 200 - 209
  0.933, 0.900, 0.867, 0.833, 0.800, 0.783, 0.750, 0.717, 0.700, 0.667, // 210 - 219
  0.650, 0.617, 0.600, 0.583, 0.550, 0.533, 0.500, 0.483, 0.467, 0.433, // 220 - 229
  0.417, 0.400, 0.383, 0.350, 0.333, 0.317, 0.300, 0.283, 0.267, 0.250, // 230 - 239
  0.233, 0.217, 0.200, 0.183, 0.167, 0.150, 0.150, 0.133, 0.117, 0.117, // 240 - 249
  0.100, 0.100, 0.083, 0.067, 0.067, 0.050, 0.050, 0.033, 0.017, 0.017, // 250 - 259
  0.017, 0.017, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, // 260 - 269
  0.000, 0.000, 0.000, 0.000, 0.017, 0.017, 0.017, 0.033, 0.033, 0.033, // 270 - 279
  0.050, 0.050, 0.067, 0.067, 0.083, 0.100, 0.100, 0.117, 0.117, 0.133, // 280 - 289
  0.150, 0.150, 0.167, 0.183, 0.200, 0.217, 0.233, 0.250, 0.267, 0.283, // 290 - 299
  0.300, 0.317, 0.333, 0.360, 0.383, 0.400, 0.417, 0.433, 0.467, 0.483, // 300 - 309
  0.500, 0.517, 0.550, 0.567, 0.600, 0.617, 0.633, 0.667, 0.683, 0.717, // 310 - 319
  0.733, 0.767, 0.783, 0.817, 0.833, 0.867, 0.883, 0.917, 0.933, 0.967, // 320 - 329
  1.000, 1.033, 1.067, 1.083, 1.117, 1.150, 1.183, 1.217, 1.233, 1.267, // 330 - 339
  1.300, 1.333, 1.367, 1.383, 1.400, 1.450, 1.483, 1.517, 1.550, 1.583, // 340 - 349
  1.617, 1.650, 1.683, 1.717, 1.750, 1.767, 1.800, 1.833, 1.867, 1.900  // 350 - 359
];
let index3 = Math.ceil(hs);if (index3 < 0) index3 = 0;
if (index3 >= lookupKamyah.length) index3 = lookupKamyah.length - 1;let kamyah = lookupKamyah[index3];let nurilhilal = kamyah + mukstulhilal;let nurilhilal2 = nurilhilal.toFixed(3);

const hari = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Ahad"];
const hitungHariMasuk = (irtipa, ijt) => hari[(ijt + (irtipa >= 2 ? 0 : 1)) % 7];
let harimasuk = hitungHariMasuk(irtipa2, ijt);
let harimasuk2 = hitungHariMasuk(irtipa2 >= 3 ? 3 : 0, ijt);
let harimasuk6 = hitungHariMasuk(irtipa2 >= 6 ? 6 : 0, ijt);
let harimasuk7 = hitungHariMasuk(irtipa2 >= 7 ? 7 : 0, ijt);
 
const imkanGoerImkan  = irtipa => irtipa >= 2 ? 'Imkan Rukyat' : 'Ghoer Imkan Rukyat';
const imkanGoerImkan2 = irtipa => irtipa >= 3 ? 'Imkan Rukyat' : 'Ghoer Imkan Rukyat';
const imkanGoerImkan3 = irtipa => irtipa >= 6 ? 'Imkan Rukyat' : 'Ghoer Imkan Rukyat';
const imkanGoerImkan4 = irtipa => irtipa >= 7 ? 'Imkan Rukyat' : 'Ghoer Imkan Rukyat';

let derajatirtipa = document.querySelector("#derajatirtipa").value;let drj = parseFloat(derajatirtipa) 

let jatuhhari;
if (drj <= 1) {
  jatuhhari = harimasuk;
} else if (drj <= 2) {
  jatuhhari = harimasuk2;
} else if (drj <= 3) {
  jatuhhari = harimasuk6;
} else {
  jatuhhari = harimasuk7;
}

let ikngoerikn;
if (drj <= 1) {
  ikngoerikn = imkanGoerImkan(irtipa2);
} else if (drj <= 2) {
  ikngoerikn = imkanGoerImkan2(irtipa2);
} else if (drj <= 3) {
  ikngoerikn = imkanGoerImkan3(irtipa2);
} else {
  ikngoerikn = imkanGoerImkan4(irtipa2);
}

let ptkimkan;
if (drj <= 1) {ptkimkan = "2°";}
else if (drj <= 2) {ptkimkan = "3°";}
else if (drj <= 3) {ptkimkan = "6°";}
else if (drj <= 4) {ptkimkan = "7°";}

let e = 1 + Math.trunc((tahunYangDimaksud * 11) / 30) + (tahunYangDimaksud * 354) + (totalbulan * 30) - Math.trunc((totalbulan - 1) / 2) - 384;let f = e + 227016;let g = Math.trunc(f / 1461);let thM = g * 4 + Math.trunc((f - g * 1461) / 365) + 1;let tjdIjt = sig <= 12 ? "Malam" : "Hari";let jmsiz = siz;let jmsiz2 = Math.trunc(jmsiz);let jmsiz3 = (jmsiz -jmsiz2) *60;let jmsiz4 = Math.trunc(jmsiz3);let jmsig = sig;let jmsig2 = Math.trunc(jmsig);let jmsig3 = (jmsig -jmsig2) *60;let jmsig4 = Math.trunc(jmsig3);let jmipa = irtipa;let jmipa2 = Math.trunc(jmipa);let jmipa3 = (jmipa -jmipa2) *60;let jmipa4 = Math.trunc(jmipa3);let jmmks = mukstulhilal;let jmmks2 = Math.trunc(jmmks);let jmmks3 = (jmmks -jmmks2) *60;let jmmks4 = Math.trunc(jmmks3);let qnh = nurilhilal;let qnh2 = Math.trunc(qnh);let qnh3 = (qnh -qnh2) *60;let qnh4 = Math.trunc(qnh3)
const bulanHijriyah = ["Dzul Hijjah", "Muharom", "Sopar", "Robiul Awal", "Robius Stani","Jumadil Awal", "Jumadis Stani", "Rojab", "Syaban", "Rhomadhon","Syawal", "Dzulqodah"];let namebulan = bulanHijriyah[(totalbulan - 1 + 12) % 12];


// KOREKSI WAKTU MAGHBRIB DAN ZAWAL

   document.getElementById('hasilHisabAkhirBulan').innerHTML = `
   
   <div class="card sholat-list">
    <div class="row"><span>Total Alamah</span><span>${hasilAkhirAlamah3}</span></div>
    <div class="row"><span>Total Hissoh</span><span>${hasilAkhirHissoh3}</span></div>
    <div class="row"><span>Total Wasath</span><span>${hasilAkhirWasat3}</span></div>
    <div class="row"><span>Total Khosoh</span><span>${hasilAkhirKhosoh3}</span></div>
    <div class="row"><span>Total Markaz</span><span>${hasilAkhirMarkaz3}</span></div>
    <div class="row"><span>Ta'dil Khosoh</span><span>${tadilkhosoh}</span></div>
    <div class="row"><span>Ta'dil Markaz</span><span>${tadilmarkaz}</span></div>
    <div class="row"><span>Bu'du Goer Muadal</span><span>${buduGoerMuadal2}</span></div>
    <div class="row"><span>Hasilu Dorob</span><span>${hasildorob2}</span></div>
    <div class="row"><span>Ta'dil Wasath</span><span>${tadilwasat2}</span></div>
    <div class="row"><span>Muqowam Syamsi</span><span>${muqowwamsyamsi2}</span></div>
    <div class="row"><span>Yaqoul Ijtima Pii burj</span><span>(${mq1}) ${mq2}</span></div>
    <div class="row"><span>Hai'atul Hilal</span><span>${mq3}</span></div>
    <div class="row"><span>Ta'dil Ayyam</span><span>${tadilayyam}</span></div>
    <div class="row"><span>Bu'du Muadal</span><span>${budumuadal2}</span></div>
    <div class="row"><span>Thuul Syams</span><span>${thulsyamsi2}</span></div>
    <div class="row"><span>Hissoh Saah</span><span>${hissohsaah}</span></div>
    <div class="row"><span>Ta'dil Alamah</span><span>${tadilalamah2}</span></div>
    <div class="row"><span>Alamah Muadalah JKT</span><span>${jkt3}</span></div>
    <div class="row"><span>Thul Balad - Longitude</span><span>${koorlong}</span></div>
    <div class="row"><span>Selisih Waktu</span><span>${selisihwaktu2}</span></div>
    <div class="row"><span>Alamah Muadalah Bibaladika +1</span><span>${bittatbieq2}</span></div>
    <div class="row"><span>Yaqoul Ijtima</span><span>(${indexYaqoulijtima}) ${yaqoulijtima}</span></div>
    <div class="row"><span>Arudh Balad - Latitude</span><span>${koorlat}</span></div> 
    <div class="row"><span>Zawal ~ pi-yaumil-ijtima</span><span>${dzuhur}</span></div>
    <div class="row"><span>Maghrib ~ pi-yaumil-ijtima</span><span>${maghrib}</span></div>
    <div class="row"><span>Saah Ijtima Bilgurubiyah</span><span>${sig2}</span></div>
    <div class="row"><span>Saah Ijtima Bizzawaliyah</span><span>${siz2}</span></div>
    <div class="row"><span>Minal Ijtima Ilal-gurub</span><span>${mig2}</span></div>
    <div class="row"><span>Irtipa Hilal Ba'dal-gurub</span><span>${irtipa2}</span></div>
    <div class="row"><span>Mukstul Hilal Fauqol-ufq</span><span>${mukstulhilal2}</span></div>
    <div class="row"><span>Kamyah Ardl-qomar</span><span>${kamyah}</span></div>
    <div class="row"><span>Qous nuril-hilal</span><span>${nurilhilal2}</span></div>
<div class="ringkasan"><b>* RINGKASAN *</b></div>
    <div class="poinHasilHisab">
    <div class="row"><span>Awal Bulan </span><span>${bulanYangDimaksud} ${tahunYangDimaksud} H</span></div>
    <div class="row"><span>Jatuh Pada Hari </span><span>${jatuhhari} ${hasilTanggalMasehi} M</span></div>
    <div class="row"><span>Ijtima Terjadi Pada ${tjdIjt}</span><span> ${yaqoulijtima}</span></div>
    <div class="row"><span>Jam Ijtima  </span><span>${jmsiz2}:${jmsiz4} WIS | ${jmsig2}:${jmsig4} WGB </span></div>
    <div class="row"><span>Ketinggian Hilal </span><span>{Malam ${yaqoulijtima2}} ${jmipa2}°${jmipa4}'</span></div>
    <div class="row"><span>Patokan Imkan </span><span>${ptkimkan} | [${ikngoerikn}]</span></div>
    <div class="row"><span>Lama Hilal diatas Ufuk </span><span>${jmmks2}:${jmmks4}</span></div>
    <div class="row"><span>Condongnya Hilal Miring ke </span><span>${mq3}</span></div>
    <div class="row"><span>Cahaya Hilal </span><span>${qnh2}°${qnh4}</span></div>
    </div>
    

   <div class="note"><small>* Penangalan masehi memakai hisab urfi / Istilahi</small></div>
   
   </div>
   
   `;
  
    // ===== PINDAH PANEL =====
    panelHisab.classList.add('hidden');
    panelHasilHisab.classList.remove('hidden');
  };
}

/* ===============================
   KEMBALI KE HISAB IJTIMA
================================ */
if (btnBackToIjtima) {
  btnBackToIjtima.onclick = () => {
    panelHasilHisab.classList.add('hidden');
    panelHisab.classList.remove('hidden');

    // pastikan kembali ke tab Ijtima
    tabs.forEach(t => t.classList.remove('active'));
    tabs[0].classList.add('active');

    contents.forEach(c => c.classList.add('hidden'));
    inputIjtima.classList.remove('hidden');
  };
}

/* ===============================
   ELEMENT UTAMA KALKULATOR
================================ */
const btnMenuKalkulator   = document.getElementById('menu-kalkulator'); // footer
const overlayKalkulator   = document.getElementById('kalkulatorOverlay');
const panelKalkulator     = document.getElementById('panelKalkulator');
const btnCloseKalkulator  = document.getElementById('closeKalkulator');

/* ===============================
   TAB & KONTEN KALKULATOR
================================ */
const tabsK = document.querySelectorAll('.kalkulator-tabs .tab');
const inputHariTahlil  = document.getElementById('inputHariTahlil');
const inputHariLahir  = document.getElementById('inputHariLahir');
const contentsK = [inputHariTahlil, inputHariLahir];
/* ===============================
   PANEL HASIL KALKULATOR > HARI TAHLIL
================================ */
const panelHasilHariTahlil = document.getElementById('panelHasilHariTahlil');
const btnHitungTahlilH  = document.getElementById('btnHitungTahlilH');
const btnBackHariTahlil = document.getElementById('btnBackHariTahlil');
const hasilHariTahlil = document.getElementById('hasilHariTahlil');

/* ===============================
   OPEN PANEL KALKULATOR
================================ */
if (btnMenuKalkulator) {
  btnMenuKalkulator.onclick = () => {
    overlayKalkulator.classList.remove('hidden');
    panelKalkulator.classList.remove('hidden');

    // reset tab
    tabsK.forEach(t => t.classList.remove('active'));
    tabsK[0].classList.add('active');

    contentsK.forEach(c => c.classList.add('hidden'));
    inputHariTahlil.classList.remove('hidden');

    // pastikan panel hasil tertutup
    if (panelHasilHariTahlil) panelHasilHariTahlil.classList.add('hidden');
  };
}
/* ===============================
   CLOSE PANEL KALKULATOR
================================ */
function closeKalkulatorPanel(){
  overlayKalkulator.classList.add('hidden');
  panelKalkulator.classList.add('hidden');
  if (panelHasilHariTahlil) panelHasilHariTahlil.classList.add('hidden');
}

overlayKalkulator.onclick  = closeKalkulatorPanel;
closeKalkulator.onclick = closeKalkulatorPanel;

/* ===============================
   TAB HANDLER
================================ */
tabsK.forEach((tab, index) => {
  tab.onclick = () => {
    tabsK.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    contentsK.forEach(c => c.classList.add('hidden'));
    contentsK[index].classList.remove('hidden');
  };
});

if (btnHitungTahlilH) {
  btnHitungTahlilH.onclick = () => {

    inputHariTahlil.classList.add("hidden");
    panelHasilHariTahlil.classList.remove("hidden");

    // ambil nilai input
    const tglWafat = parseInt(document.getElementById("tglWafat").value);
    const blnWafat = parseInt(document.getElementById("blnWafat").value);
    const thnWafat = parseInt(document.getElementById("thnWafat").value);

    const namaBulanH = [
      "", "Muharram","Shafar","Rabiul Awal","Rabiul Akhir",
      "Jumadil Awal","Jumadil Akhir","Rajab","Sya'ban",
      "Ramadhan","Syawal","Dzulqa'dah","Dzulhijjah"
    ];

    function hariBulanH(bulan) {
      return bulan % 2 === 1 ? 30 : 29; // urfi
    }

    function tambahHariH(t, b, y, n) {
      while (n > 0) {
        let sisa = hariBulanH(b) - t;
        if (n <= sisa) {
          t += n;
          n = 0;
        } else {
          n -= (sisa + 1);
          t = 1;
          b++;
          if (b > 12) {
            b = 1;
            y++;
          }
        }
      }
      return { t, b, y };
    }

    const agenda = [
      { nama: "1 Hari", h: 0 },
      { nama: "3 Hari", h: 2 },
      { nama: "7 Hari", h: 6 },
      { nama: "40 Hari", h: 39 },
      { nama: "100 Hari", h: 99 },
      { nama: "Haul (1 Tahun)", y: 1 }
    ];
let html = `
  <div class="card">
    <table class="tahlil-table">
      <thead>
        <tr>
          <th>Amalan</th>
          <th>Tanggal Hijriyah</th>
        </tr>
      </thead>
      <tbody>
`;

agenda.forEach(a => {
  let r;
  if (a.y) {
    r = { t: tglWafat, b: blnWafat, y: thnWafat + a.y };
  } else {
    r = tambahHariH(tglWafat, blnWafat, thnWafat, a.h);
  }

  html += `
    <tr>
      <td><span>${a.nama}</span></td>
      <td>${r.t} ${namaBulanH[r.b]} ${r.y} H</td>
    </tr>
  `;
});

html += `
      </tbody>
    </table>
    <div class="note">
      <small>* Perhitungan berdasarkan Hijriyah (hisab urfi)</small>
    </div>
  </div>
`;

hasilHariTahlil.innerHTML = html;
    
  };
}

if (btnBackHariTahlil) {
  btnBackHariTahlil.onclick = () => {
    inputHariTahlil.classList.remove("hidden");
    panelHasilHariTahlil.classList.add("hidden");
  };
}

const btnHitungHari = document.getElementById('calculateDays')
if (btnHitungHari) {
  btnHitungHari.onclick = () => { 
    
    const birthdate = document.getElementById('birthdate').value;
      const resultDays = document.getElementById('resultDays');
      const resultYearsMonthsDays = document.getElementById('resultYearsMonthsDays');
      if (birthdate) {
        const birthDateObj = new Date(birthdate);
        const currentDate = new Date();
        const timeDifference = currentDate - birthDateObj;
        const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24)+1);
        resultDays.value = daysDifference;

        // Calculate years, months, and days
        let years = currentDate.getFullYear() - birthDateObj.getFullYear();
        let monthsL = currentDate.getMonth() - birthDateObj.getMonth();
        let daysL = currentDate.getDate() - birthDateObj.getDate();

        if (daysL < 0) {
          monthsL--;
          daysL += new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
        }

        if (monthsL < 0) {
          years--;
          monthsL += 12;
        }

        resultYearsMonthsDays.value = `${years} Tahun, ${monthsL} Bulan, ${daysL} Hari`;
      } else {
        resultDays.value = 'Please enter a valid date';
        resultYearsMonthsDays.value = '';
      }
    
  }
}