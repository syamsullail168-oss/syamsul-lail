
    const zonaWaktu = 7;
    const φ = lokasi.lon;
    const λ = lokasi.lat;
    const ihtiyat = 2 / 60;
    
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

    const terbit = zawal - tTerbit - ihtiyat;
    const dzuhur = zawal + ihtiyat;
    const maghrib = zawal + tMaghrib + ihtiyat;
    