// lib/timezone.js
import cityTimezones from "city-timezones";
import { DateTime } from "luxon";
import geoTz from "geo-tz";

function pickCityRecord(city, country) {
  if (!city) return null;
  const results = cityTimezones.lookupViaCity(city) || [];
  if (results.length === 0) return null;

  if (country) {
    const match = results.find(
      r => r.country && r.country.toLowerCase() === country.toLowerCase()
    );
    if (match) return match;
  }
  return results[0];
}

export async function resolveTimezone(city, country) {
  const record = pickCityRecord(city, country);

  let timezone = record?.timezone || null;
  let source = "city-timezones";

  if (record?.lat && record?.lng) {
    const lat = parseFloat(record.lat);
    const lng = parseFloat(record.lng);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const candidates = geoTz.find(lat, lng);
      if (candidates && candidates.length > 0) {
        timezone = candidates[0];
        source = "geo-tz";
      }
    }
  }

  if (!timezone) {
    if ((country || "").toLowerCase() === "indonesia") {
      timezone = "Asia/Jakarta";
    } else {
      timezone = "UTC";
    }
  }

  const offset = DateTime.now().setZone(timezone).toFormat("ZZ");

  return {
    timezone,
    offset,
    source
  };
}
