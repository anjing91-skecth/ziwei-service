import express from "express";
import cors from "cors";
import { astro } from "iztro";
import fetch from "node-fetch";
import { DateTime } from "luxon";
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveTimezone } from "./lib/timezone.js";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BAZI_GO_PORT = process.env.BAZI_GO_PORT || "8081";
const usesCustomBaziUrl = Boolean(process.env.BAZI_SERVICE_URL);
const BAZI_SERVICE_URL =
  process.env.BAZI_SERVICE_URL || `http://127.0.0.1:${BAZI_GO_PORT}`;
const EMBED_BAZI = process.env.EMBED_BAZI !== "false";
const BAZI_GO_BINARY =
  process.env.BAZI_GO_BINARY || path.join(__dirname, "bazi-go", "bazi-go");

let baziProcess = null;
let embeddedBaziReady = false;
let embeddedBaziError = null;
let cachedGoAvailability = null;

function hasGoToolchain() {
  if (cachedGoAvailability !== null) {
    return cachedGoAvailability;
  }
  try {
    const result = spawnSync("go", ["version"], { stdio: "ignore" });
    cachedGoAvailability = !result.error && result.status === 0;
  } catch (err) {
    cachedGoAvailability = false;
  }
  return cachedGoAvailability;
}

function determineBaziCommand() {
  const custom = process.env.BAZI_GO_CMD;
  if (custom) {
    return {
      command: {
        cmd: custom,
        args: [],
        cwd: __dirname,
        shell: true
      }
    };
  }
  if (fs.existsSync(BAZI_GO_BINARY)) {
    return { command: { cmd: BAZI_GO_BINARY, args: [] } };
  }
  const sourceDir = path.join(__dirname, "bazi-go");
  if (fs.existsSync(path.join(sourceDir, "main.go"))) {
    if (hasGoToolchain()) {
      return {
        command: {
          cmd: "go",
          args: ["run", "-mod=vendor", "main.go"],
          cwd: sourceDir
        }
      };
    }
    return {
      command: null,
      warning:
        "Go toolchain is not available. Install Go or provide BAZI_GO_BINARY so the embedded service can start."
    };
  }
  return {
    command: null,
    warning:
      "Could not find BaZi binary or source directory. Set BAZI_SERVICE_URL to a remote BaZi API or supply BAZI_GO_BINARY."
  };
}

function startEmbeddedBazi() {
  embeddedBaziReady = false;
  embeddedBaziError = null;

  if (!EMBED_BAZI) {
    console.log(
      `[BaZi] Embedded mode disabled; expecting service at ${BAZI_SERVICE_URL}`
    );
    return;
  }

  const { command: spawnInfo, warning } = determineBaziCommand();
  if (!spawnInfo) {
    embeddedBaziError =
      warning ||
      "Could not resolve command to launch the embedded BaZi service.";
    console.warn(`[BaZi] ${embeddedBaziError}`);
    return;
  }

  console.log("[BaZi] Starting embedded BaZi service...");
  baziProcess = spawn(spawnInfo.cmd, spawnInfo.args, {
    cwd: spawnInfo.cwd,
    shell: spawnInfo.shell || false,
    env: {
      ...process.env,
      PORT: BAZI_GO_PORT
    },
    stdio: ["ignore", "inherit", "inherit"]
  });

  embeddedBaziReady = true;

  baziProcess.on("error", err => {
    embeddedBaziReady = false;
    embeddedBaziError = err?.message || String(err);
    console.error("[BaZi] Failed to start embedded service:", err);
  });

  baziProcess.on("exit", (code, signal) => {
    embeddedBaziReady = false;
    console.error(
      `[BaZi] Embedded service exited (code=${code ?? "null"}, signal=${
        signal ?? "null"
      }).`
    );
  });

  console.log(`[BaZi] Embedded service PID: ${baziProcess.pid}`);
}

function stopEmbeddedBazi() {
  if (!baziProcess) {
    return Promise.resolve();
  }

  const child = baziProcess;
  baziProcess = null;
  console.log(`[BaZi] Stopping embedded service (pid=${child.pid})...`);

  return new Promise(resolve => {
    const forceKillTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        console.warn("[BaZi] Embedded service still running; force killing.");
        child.kill("SIGKILL");
      }
    }, 4000);

    const handleExit = () => {
      clearTimeout(forceKillTimer);
      resolve();
    };

    child.once("exit", handleExit);
    child.kill("SIGTERM");
  });
}
function embeddedBaziUnavailable() {
  if (!EMBED_BAZI || usesCustomBaziUrl) {
    return false;
  }
  return !embeddedBaziReady;
}

async function buildBaziPayload(body) {
  const {
    birthDate,
    birthTime,
    city,
    birthPlace,
    country,
    birthCountry,
    timezone: timezoneOverride
  } = body || {};

  const cityInput = city || birthPlace || null;
  const countryInput = country || birthCountry || null;

  if (!birthDate) {
    throw new Error("birthDate is required");
  }

  const normalizedTime = birthTime || "12:00";
  let detectedTimezone = timezoneOverride;
  let timezoneSource = timezoneOverride ? "request" : "city-timezones";
  let offset = null;

  if (!detectedTimezone) {
    const tzInfo = await resolveTimezone(cityInput, countryInput);
    detectedTimezone = tzInfo?.timezone;
    timezoneSource = tzInfo?.source || "fallback";
    offset = tzInfo?.offset || null;
  }

  const localDateTime = DateTime.fromISO(`${birthDate}T${normalizedTime}`, {
    zone: detectedTimezone || "UTC"
  });
  if (!localDateTime.isValid) {
    throw new Error("Invalid birthDate/birthTime or timezone.");
  }

  const beijingDateTime = localDateTime.setZone("Asia/Shanghai");

  return {
    payload: {
      birthDate: beijingDateTime.toFormat("yyyy-MM-dd"),
      birthTime: birthTime ? beijingDateTime.toFormat("HH:mm") : ""
    },
    meta: {
      requestedDate: birthDate,
      requestedTime: birthTime || null,
      city: cityInput,
      country: countryInput,
      detectedTimezone: localDateTime.zoneName,
      timezoneSource,
      timezoneOffset: offset || localDateTime.offsetNameLong || null,
      beijingDate: beijingDateTime.toFormat("yyyy-MM-dd"),
      beijingTime: beijingDateTime.toFormat("HH:mm"),
      beijingISO: beijingDateTime.toISO()
    }
  };
}

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
      birthPlace,
      country,
      birthCountry,
      gender
    } = req.body || {};

    if (!birthDate_iso || !birthTime || !gender) {
      return res.status(400).json({
        error: "Missing required fields: birthDate_iso, birthTime, gender"
      });
    }

    const genderNormalized = normalizeGender(gender);
    const hourIndex = getHourIndexFromTime(birthTime);
    const cityInput = city || birthPlace || null;
    const countryInput = country || birthCountry || null;

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
        city: cityInput,
        country: countryInput,
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
  try {
    const { payload, meta } = await buildBaziPayload(req.body || {});

    if (embeddedBaziUnavailable()) {
      return res.status(503).json({
        success: false,
        error: "bazi_service_unavailable",
        message:
          embeddedBaziError ||
          "Embedded BaZi service is not running. Provide BAZI_SERVICE_URL or install Go/BAZI_GO_BINARY.",
        meta
      });
    }

    const response = await fetch(`${BAZI_SERVICE_URL}/bazi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);
    if (data && typeof data === "object") {
      return res.status(response.status).json({
        ...data,
        meta: {
          ...(data.meta || {}),
          ...meta
        }
      });
    }

    return res.status(502).json({
      success: false,
      error: "BaZi service returned a non-JSON response",
      meta
    });
  } catch (err) {
    const message = err?.message || String(err);
    const isValidation = message.toLowerCase().includes("birthdate");
    console.error("BaZi payload error:", err);
    return res.status(isValidation ? 400 : 500).json({
      success: false,
      error: isValidation ? "invalid_birth_data" : "internal_error",
      message,
      meta: err.meta || null
    });
  }
});

// Health check sederhana
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "ziwei-service" });
});

startEmbeddedBazi();

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Ziwei service listening on port ${port}`);
});

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`);
  try {
    await stopEmbeddedBazi();
  } catch (err) {
    console.error("[BaZi] Error while stopping embedded service:", err);
  }
  server.close(() => {
    process.exit(0);
  });
}

["SIGINT", "SIGTERM"].forEach(signal => {
  process.on(signal, () => gracefulShutdown(signal));
});

process.on("exit", stopEmbeddedBazi);
