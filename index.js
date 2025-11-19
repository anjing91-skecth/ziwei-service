import express from "express";
import cors from "cors";
import { DateTime } from "luxon";
import cityTimezones from "city-timezones";
import { astro } from "iztro";

const app = express();
app.use(cors());
app.use(express.json());

function findTimezone(cityName, countryName) {
  const results = cityTimezones.lookupViaCity(cityName);

  if (!results || results.length === 0) {
    console.warn("City not found, fallback to UTC");
    return "UTC";
  }

  // Filter berdasarkan negara kalau ada
  if (countryName) {
    const filtered = results.filter(
      r => r.country.toLowerCase() === countryName.toLowerCase()
    );
    if (filtered.length > 0) return filtered[0].timezone;
  }

  return results[0].timezone; // default result
}

function getTimeIndex(hour) {
  if (hour === 23) return 0;
  return Math.floor(hour / 2); // 0–11 cabang bumi
}

app.post("/ziwei", (req, res) => {
  try {
    const { birthDate_iso, birthTime, city, country, gender = "unknown" } = req.body;

    if (!birthDate_iso || !birthTime || !city) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const detectedTz = findTimezone(city, country);

    const localDT = DateTime.fromISO(`${birthDate_iso}T${birthTime}`, {
      zone: detectedTz
    });

    const beijingDT = localDT.setZone("Asia/Shanghai");

    const solarDate = beijingDT.toFormat("yyyy-MM-dd");
    const hour = beijingDT.hour;
    const timeIndex = getTimeIndex(hour);

    const astrolabe = astro.astrolabeBySolarDate(
      solarDate,
      timeIndex,
      gender,
      true,
      "zh-cn"
    );

    return res.json({
      ok: true,
      detected_timezone: detectedTz,
      beijing_date: solarDate,
      beijing_hour: hour,
      timeIndex,
      astrolabe
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Running on 3000"));
