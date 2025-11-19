// index.js
const express = require('express');
const cors = require('cors');
const { DateTime } = require('luxon');
const { Solar } = require('lunar-javascript');

const app = express();

app.use(cors());
app.use(express.json());

// --- helper: tebak timezone lokal sederhana ---
// v1: fokus Indonesia dulu, sisanya fallback ke Asia/Shanghai
function guessTimezone(country, city) {
  const c = (country || '').toLowerCase().trim();
  const k = (city || '').toLowerCase().trim();

  // Indonesia – v1: pakai Asia/Jakarta dulu (cukup untuk Bandung, Jakarta, dst)
  if (c === 'indonesia') {
    return 'Asia/Jakarta';
  }

  // fallback: langsung pakai Asia/Shanghai (CST) kalau nggak jelas
  return 'Asia/Shanghai';
}

// helper normalisasi gender untuk nanti kalau mau pakai getYun()
function normalizeGender(raw) {
  const g = (raw || '').toString().toLowerCase().trim();
  if (['male', 'laki-laki', 'pria', 'laki laki', 'l'].includes(g)) return 1;   // 1 = male
  if (['female', 'perempuan', 'wanita', 'p'].includes(g)) return 0;            // 0 = female
  return 1; // default male
}

// health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// endpoint utama
app.post('/ziwei', (req, res) => {
  try {
    const body = req.body || {};
    const {
      birthDate_iso,   // "1993-11-08"
      birthTime,       // "16:05"
      city,
      country,
      gender
    } = body;

    if (!birthDate_iso) {
      return res.status(400).json({
        ok: false,
        error: 'birthDate_iso is required (e.g. "1993-11-08")'
      });
    }

    // kalau jam kosong / format aneh, fallback ke tengah hari
    let timeStr = (birthTime || '').trim();
    if (!/^\d{1,2}:\d{2}$/.test(timeStr)) {
      timeStr = '12:00';
    }

    // timezone lokal berdasarkan negara/kota
    const localZone = guessTimezone(country, city);

    // buat DateTime lokal
    const localDateTime = DateTime.fromISO(
      `${birthDate_iso}T${timeStr}`,
      { zone: localZone }
    );

    if (!localDateTime.isValid) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid birthDate_iso or birthTime'
      });
    }

    // konversi ke Beijing time (Asia/Shanghai) untuk perhitungan lunar/BaZi
    const beijingDateTime = localDateTime.setZone('Asia/Shanghai');

    // konversi ke kalender lunar pakai lunar-javascript
    const solar = Solar.fromYmdHms(
      beijingDateTime.year,
      beijingDateTime.month,
      beijingDateTime.day,
      beijingDateTime.hour,
      beijingDateTime.minute,
      beijingDateTime.second
    );

    const lunar = solar.getLunar();
    const eightChar = lunar.getEightChar(); // BaZi

    // data lunar dasar
    const lunarInfo = {
      year: lunar.getYear(),           // tahun lunar (angka)
      month: lunar.getMonth(),         // bulan lunar
      day: lunar.getDay(),             // tanggal lunar
      isLeapMonth: lunar.isLeap(),     // true/false
      yearGanZhi: lunar.getYearInGanZhi(),   // e.g. "癸酉"
      monthGanZhi: lunar.getMonthInGanZhi(),
      dayGanZhi: lunar.getDayInGanZhi(),
      timeGanZhi: lunar.getTimeInGanZhi(),
      yearShengXiao: lunar.getYearShengXiao(), // zodiak Cina (Ayam, Anjing, etc.)
    };

    // BaZi: 4 pilar GanZhi
    const bazi = {
      year: eightChar.getYear(),   // e.g. "癸酉"
      month: eightChar.getMonth(),
      day: eightChar.getDay(),
      time: eightChar.getTime()
    };

    // NaYin masing-masing pilar (buat flavor text kalau mau)
    const nayin = {
      year: eightChar.getYearNaYin(),
      month: eightChar.getMonthNaYin(),
      day: eightChar.getDayNaYin(),
      time: eightChar.getTimeNaYin()
    };

    // kalau nanti mau pakai DaYun/LiuNian:
    // const genderCode = normalizeGender(gender);
    // const yun = eightChar.getYun(genderCode, 1);
    // const daYun = yun.getDaYun();
    // ... dst (bisa dikirim juga ke LLM kalau mau bacaan prediksi)

    res.json({
      ok: true,
      input: {
        birthDate_iso,
        birthTime: timeStr,
        city,
        country,
        gender
      },
      time: {
        local: {
          iso: localDateTime.toISO(),
          timezone: localZone,
          offset: localDateTime.toFormat('ZZ')
        },
        beijing: {
          iso: beijingDateTime.toISO(),
          timezone: 'Asia/Shanghai',
          offset: beijingDateTime.toFormat('ZZ')
        }
      },
      lunar: lunarInfo,
      bazi,
      nayin
      // di fase berikutnya kamu bisa tambahkan:
      // daYun, liuNian, dst
      // dan/atau struktur "ziwei_chart" kalau sudah punya algoritma placement bintang
    });
  } catch (err) {
    console.error('Ziwei service error:', err);
    res.status(500).json({
      ok: false,
      error: err.message || 'Internal Server Error'
    });
  }
});

// port binding untuk Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ziwei service listening on port ${PORT}`);
});
