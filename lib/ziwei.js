// lib/ziwei.js
// Contoh – SESUAIKAN dengan iztro yang kamu deploy
// Misalnya kamu punya fungsi: solarToLunar, getGanZhi
import iztro from "iztro"; // sesuaikan import
const { solarToLunar, getGanZhi } = iztro;

export function computeZiWeiData({ birthDate_iso, birthTime, timezone }) {
  // Gabung jadi ISO dengan timezone (sederhana, tanpa offset string parsing)
  const dateTimeStr = birthTime
    ? `${birthDate_iso}T${birthTime}:00`
    : `${birthDate_iso}T00:00:00`;

  // Di sini idealnya kamu pakai library datetime yang support timezone (luxon, dayjs-timezone, dsb)
  const dateObj = new Date(dateTimeStr); // Sederhana: diasumsikan sudah lokal → adaptasi sesuai kebutuhan

  // 1) Konversi ke lunar
  const lunar = solarToLunar(dateObj);

  // 2) Hitung GanZhi (Heavenly Stems & Earthly Branches)
  const ganzhi = getGanZhi(dateObj);

  // Kamu bisa expand di sini:
  // - mapping 12 palace
  // - mapping main stars
  // - dll
  return {
    solar: {
      date_iso: birthDate_iso,
      time: birthTime,
      timezone
    },
    lunar,   // { year, month, day, isLeapMonth, ... }
    ganzhi   // { year: "...", month: "...", day: "...", hour: "..." }
  };
}
