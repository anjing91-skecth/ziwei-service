import express from "express";
import cors from "cors";
import { DateTime } from "luxon";
import { astro } from "iztro";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());// index.js
import express from "express";
import cors from "cors";
import { resolveTimezone } from "./lib/timezone.js";
import { computeZiWeiData } from "./lib/ziwei.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "ziwei-microservice" });
});

app.post("/ziwei", async (req, res) => {
  try {
    const {
      birthDate_iso,
      birthTime,
      city,
      country,
      gender = "unknown"
    } = req.body || {};

    if (!birthDate_iso || !city || !country) {
      return res.status(400).json({
        error: "birthDate_iso, city, dan country wajib diisi"
      });
    }

    // 1) Cari timezone dari API eksternal
    const { timezone, offset } = await resolveTimezone(city, country);

    // 2) Hitung data teknis ZiWei (lunar, ganzhi, dsb)
    const core = computeZiWeiData({
      birthDate_iso,
      birthTime,
      timezone
    });

    // 3) Susun response yang enak dipakai LLM
    res.json({
      input: {
        birthDate_iso,
        birthTime,
        city,
        country,
        gender,
        timezone,
        utc_offset: offset
      },
      ziwei_core: core
      // nanti kamu bisa tambah:
      // ziwei_palaces,
      // ziwei_mainStars,
      // ziwei_transforms,
      // dll
    });
  } catch (err) {
    console.error("POST /ziwei error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ZiWei service running on port ${PORT}`);
});


// Utility: mapping jam → timeIndex (12 cabang bumi)
// Zi (子) : 23:00–00:59 => 0
// Chou(丑): 01:00–02:59 => 1
// Yin (寅): 03:00–04:59 => 2
// ...
function getTimeIndexByHour(hour) {
  // jam 23 dianggap Zi hour
  if (hour === 23) return 0;
  return Math.floor(hour / 2); // 0–22 → 0–11
}

/**
 * POST /ziwei/astrolabe
 * Body contoh:
 * {
 *   "birthDate_iso": "1993-11-08",
 *   "birthTime": "16:05",
 *   "timezone": "Asia/Jakarta",
 *   "gender": "female"
 * }
 */
app.post("/ziwei/astrolabe", (req, res) => {
  try {
    const {
      birthDate_iso,
      birthTime,
      timezone,
      gender = "unknown",
      language = "zh-cn" // atau "zh-tw" / "en-us" kalau mau
    } = req.body || {};

    if (!birthDate_iso || !birthTime || !timezone) {
      return res.status(400).json({
        error: "birthDate_iso, birthTime, dan timezone wajib diisi"
      });
    }

    // 1) Buat DateTime lokal dari data user
    //    Format ekspektasi: birthDate_iso = "YYYY-MM-DD", birthTime = "HH:mm"
    const localDT = DateTime.fromISO(`${birthDate_iso}T${birthTime}`, {
      zone: timezone
    });

    if (!localDT.isValid) {
      return res.status(400).json({
        error: "Tanggal/jam tidak valid",
        details: localDT.invalidExplanation
      });
    }

    // 2) Konversi ke Beijing time (Asia/Shanghai)
    const beijingDT = localDT.setZone("Asia/Shanghai");

    // 3) Ambil tanggal solar (YYYY-MM-DD) & hour untuk timeIndex
    const solarDateStr = beijingDT.toFormat("yyyy-MM-dd");
    const hourBeijing = beijingDT.hour; // 0–23
    const timeIndex = getTimeIndexByHour(hourBeijing);

    // 4) Panggil iztro
    //   astrolabeBySolarDate(solarDate, timeIndex, gender, fixLeap?, language?)
    //   gender bisa "male" / "female" / "unknown"
    const astrolabe = astro.astrolabeBySolarDate(
      solarDateStr,
      timeIndex,
      gender,
      true,      // fixLeap, biasanya true
      language   // "zh-cn" / "en-us" dsb
    );

    // 5) Response ke n8n
    return res.json({
      ok: true,
      input: {
        birthDate_iso,
        birthTime,
        timezone,
        normalized: {
          beijingDate: solarDateStr,
          beijingHour: hourBeijing,
          timeIndex
        }
      },
      astrolabe
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

// Simple healthcheck
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "iztro-ziwei-api" });
});

app.listen(PORT, () => {
  console.log(`iztro API listening on port ${PORT}`);
});
