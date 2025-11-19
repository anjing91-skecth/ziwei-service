import express from "express";
import cors from "cors";
import { DateTime } from "luxon";
import { astro } from "iztro";
import { resolveTimezone } from "./lib/timezone.js";
import { computeZiWeiData } from "./lib/ziwei.js";

const app = express();
app.use(cors());
app.use(express.json());

function getTimeIndex(hour) {
  if (hour === 23) return 0;
  return Math.floor(hour / 2); // 0–11 cabang bumi
}

app.post("/ziwei", async (req, res) => {
  try {
    const { birthDate_iso, birthTime, city, country, gender = "unknown" } = req.body;

    if (!birthDate_iso || !birthTime || !city) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const tzResult = await resolveTimezone(city, country);
    const detectedTz = tzResult.timezone;

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

    const ziweiData = computeZiWeiData({
      birthDate_iso,
      birthTime,
      timezone: detectedTz
    });

    return res.json({
      ok: true,
      detected_timezone: detectedTz,
      timezone_offset: tzResult.offset,
      beijing_date: solarDate,
      beijing_hour: hour,
      timeIndex,
      astrolabe,
      ziwei: ziweiData
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Running on 3000"));
