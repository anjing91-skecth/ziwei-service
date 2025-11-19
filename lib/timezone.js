// lib/timezone.js
import fetch from "node-fetch";

const TZ_API_URL = process.env.TZ_API_URL;   // mis: https://api.example.com/timezone
const TZ_API_KEY = process.env.TZ_API_KEY;   // kalau perlu key

export async function resolveTimezone(city, country) {
  const qCity = encodeURIComponent(city || "");
  const qCountry = encodeURIComponent(country || "");

  // Contoh pola URL – sesuaikan dengan API yang kamu pakai
  const url = `${TZ_API_URL}?city=${qCity}&country=${qCountry}&key=${TZ_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`TZ API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();

    // Sesuaikan parsing dengan struktur data API-mu
    const timezone =
      data.timezone ||
      data.timezoneId ||
      data.zoneName ||
      "UTC";

    const offset =
      data.gmtOffsetStr ||
      data.utcOffset ||
      "+00:00";

    return {
      timezone,
      offset
    };
  } catch (err) {
    console.error("resolveTimezone error:", err.message);

    // Fallback sangat kasar (boleh kamu perkuat dengan mapping manual)
    if ((country || "").toLowerCase() === "indonesia") {
      return { timezone: "Asia/Jakarta", offset: "+07:00" };
    }

    return { timezone: "UTC", offset: "+00:00" };
  }
}
