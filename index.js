import express from "express";
import { astro } from "iztro";

const app = express();
app.use(express.json());

/**
 * Konversi "HH:MM" → index jam 0-11
 * Rumus umum Ziwei: tiap 2 jam 1 cabang.
 * 23:00–00:59   → 0 (Zi / Rat)
 * 01:00–02:59   → 1 (Chou)
 * 03:00–04:59   → 2 (Yin)
 * ...
 * 21:00–22:59   → 11 (Hai)
 */
function getHourIndexFromTime(timeStr) {
  if (!timeStr) return 0;
  const [hhStr] = String(timeStr).split(":");
  const h = parseInt(hhStr, 10);
  if (Number.isNaN(h)) return 0;

  // formula: floor(((h + 1) % 24) / 2)
  return Math.floor(((h + 1) % 24) / 2);
}

/**
 * Optional: normalisasi gender ke "male"/"female"
 */
function normalizeGender(g) {
  if (!g) return "male";
  const s = String(g).toLowerCase();
  if (s.includes("perempuan") || s.includes("wanita") || s.includes("female")) {
    return "female";
  }
  return "male";
}

/**
 * Endpoint utama untuk n8n
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
        error: "Missing required fields: birthDate_iso, birthTime, gender"
      });
    }

    const genderNormalized = normalizeGender(gender);
    const hourIndex = getHourIndexFromTime(birthTime);

    // birthDate_iso sudah format "YYYY-MM-DD"
    const solarDate = birthDate_iso;

    // Panggil iztro → sesuai dokumentasi
    const astrolabe = astro.astrolabeBySolarDate(
      solarDate,
      hourIndex,
      genderNormalized
    );

    return res.json({
      input: {
        birthDate_iso,
        birthTime,
        city: city || null,
        country: country || null,
        gender: genderNormalized,
        hourIndex
      },
      astrolabe
    });
  } catch (err) {
    console.error("Ziwei error:", err);
    return res.status(500).json({
      error: "internal_error",
      message: err?.message || String(err)
    });
  }
});

// Health check sederhana
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "ziwei-service" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Ziwei service listening on port ${port}`);
});
