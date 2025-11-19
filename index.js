// index.js
const express = require("express");
const cors = require("cors");
const { astro } = require("iztro");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/**
 * Normalisasi gender dari form → karakter Mandarin untuk iztro
 * - "male", "laki-laki", "pria", "cowok" → "男"
 * - "female", "perempuan", "wanita", "cewek" → "女"
 */
function normalizeGender(gender) {
  if (!gender) return "女";
  const v = String(gender).trim().toLowerCase();

  const maleList = ["male", "laki-laki", "laki", "pria", "cowok", "man"];
  const femaleList = ["female", "perempuan", "wanita", "cewek", "woman"];

  if (maleList.includes(v)) return "男";
  if (femaleList.includes(v)) return "女";

  // default fallback
  return "女";
}

/**
 * Parse "HH:MM" → { hour, minute }
 */
function parseTimeString(timeStr) {
  if (!timeStr) return { hour: 0, minute: 0 };

  const match = String(timeStr).match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return { hour: 0, minute: 0 };

  let hour = parseInt(match[1], 10);
  let minute = parseInt(match[2], 10);

  if (Number.isNaN(hour)) hour = 0;
  if (Number.isNaN(minute)) minute = 0;

  // clamp
  hour = Math.max(0, Math.min(23, hour));
  minute = Math.max(0, Math.min(59, minute));

  return { hour, minute };
}

/**
 * Konversi jam (0–23) → index cabang bumi (0–11) untuk iztro
 *
 * Aturan jam Zi:
 * - 23:00–00:59  → 子 → index 0
 * - 01:00–02:59  → 丑 → index 1
 * - 03:00–04:59  → 寅 → index 2
 * ...
 * - 21:00–22:59  → 亥 → index 11
 */
function getHourBranchIndex(hour) {
  if (hour === 23) return 0;
  return Math.floor((hour + 1) / 2); // hasil: 0–11
}

// Endpoint sederhana untuk cek service hidup
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "ziwei-service",
    docs: "POST /ziwei dengan body { birthDate_iso, birthTime, city, country, gender }"
  });
});

/**
 * Endpoint utama: generate Zi Wei astrolabe pakai iztro
 * Body yang diharapkan:
 * {
 *   "birthDate_iso": "1993-11-08",
 *   "birthTime": "16:05",
 *   "city": "Bandung",
 *   "country": "Indonesia",
 *   "gender": "male"
 * }
 */
app.post("/ziwei", (req, res) => {
  try {
    const {
      birthDate_iso,
      birthTime,
      city,
      country,
      gender
    } = req.body || {};

    if (!birthDate_iso || !birthTime || !gender) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["birthDate_iso", "birthTime", "gender"]
      });
    }

    // Normalisasi tanggal → "YYYY-M-D" (tanpa leading zero) seperti contoh iztro
    const [yearStr, monthStr, dayStr] = String(birthDate_iso).split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const solarDate = `${year}-${month}-${day}`; // contoh: "1993-11-8"

    // Jam → index cabang bumi
    const { hour } = parseTimeString(birthTime);
    const hourBranchIndex = getHourBranchIndex(hour);

    // Gender → "男"/"女"
    const genderChar = normalizeGender(gender);

    // Panggil iztro
    const astrolabe = astro.bySolar(
      solarDate,
      hourBranchIndex,
      genderChar,
      true,        // isBirthSolar: true (pakai tanggal matahari)
      "en-US"      // output bahasa Inggris, bisa diganti "zh-CN"/"zh-TW" kalau mau asli Mandarin
    );

    return res.json({
      input: {
        birthDate_iso,
        birthTime,
        solarDate,
        city,
        country,
        gender,
        genderChar,
        hourBranchIndex
      },
      astrolabe
    });
  } catch (err) {
    console.error("Ziwei error:", err);
    return res.status(500).json({
      error: "Failed to generate Zi Wei chart",
      detail: err.message || String(err)
    });
  }
});

app.listen(PORT, () => {
  console.log(`ziwei-service listening on port ${PORT}`);
});
