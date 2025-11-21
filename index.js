import express from "express";
import cors from "cors";
import { astro } from "iztro";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const BAZI_SERVICE_URL = process.env.BAZI_SERVICE_URL || "http://localhost:8081";

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

app.post("/bazi", async (req, res) => {
  const { birthDate, birthTime } = req.body || {};
  if (!birthDate) {
    return res.status(400).json({
      success: false,
      error: "birthDate is required"
    });
  }

  try {
    const response = await fetch(`${BAZI_SERVICE_URL}/bazi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthDate, birthTime })
    });

    const data = await response.json().catch(() => null);
    if (data) {
      return res.status(response.status).json(data);
    }

    return res.status(502).json({
      success: false,
      error: "BaZi service returned a non-JSON response"
    });
  } catch (err) {
    console.error("BaZi proxy error:", err);
    return res.status(502).json({
      success: false,
      error: `Failed to contact BaZi service: ${err?.message || String(err)}`
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
