import dgram from "node:dgram";
import express from "express";
import { performance } from "node:perf_hooks";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);

const DEFAULT_CACHED_DOMAINS = [
  "example.com",
  "google.com",
  "cloudflare.com",
  "wikipedia.org",
  "github.com"
];

const DEFAULT_UNCACHED_BASE_DOMAINS = [
  "example.com",
  "google.com",
  "cloudflare.com",
  "wikipedia.org",
  "github.com"
];

const MODES = ["cached", "uncached"];

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: Date.now() });
});

app.post("/api/benchmark", async (req, res) => {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Connection", "keep-alive");

  const runId = `run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const controller = new AbortController();

  res.on("close", () => {
    if (!res.writableEnded) {
      controller.abort(new Error("client-disconnected"));
    }
  });

  try {
    const providers = sanitizeProviders(req.body?.providers);
    const settings = sanitizeSettings(req.body?.settings);

    if (providers.length === 0) {
      writeEvent(res, {
        type: "run-error",
        runId,
        message: "沒有可用的 DNS 供應商。"
      });
      res.end();
      return;
    }

    writeEvent(res, { type: "run-start", runId, ts: Date.now(), settings });

    const results = [];
    for (const provider of providers) {
      throwIfAborted(controller.signal);
      writeEvent(res, { type: "provider-start", runId, providerId: provider.id, provider });
      const summary = await runProviderBenchmark({
        provider,
        settings,
        signal: controller.signal,
        onSample: (event) => writeEvent(res, { ...event, runId, providerId: provider.id })
      });
      results.push(summary);
      writeEvent(res, {
        type: "provider-done",
        runId,
        providerId: provider.id,
        summary
      });
    }

    writeEvent(res, {
      type: "run-done",
      runId,
      results
    });
    res.end();
  } catch (error) {
    if (controller.signal.aborted) {
      writeEvent(res, {
        type: "run-stopped",
        runId,
        message: "測試已停止（連線中斷或手動中止）。"
      });
      res.end();
      return;
    }

    writeEvent(res, {
      type: "run-error",
      runId,
      message: error instanceof Error ? error.message : "未知的測試錯誤"
    });
    res.end();
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[server] DNS benchmark API listening on http://${HOST}:${PORT}`);
});

function writeEvent(res, payload) {
  if (res.writableEnded || res.destroyed) {
    return;
  }
  res.write(`${JSON.stringify(payload)}\n`);
}

function sanitizeProviders(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const output = [];
  for (const item of value) {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const ip = typeof item?.ip === "string" ? item.ip.trim() : "";
    if (!id || !name || !isValidIPv4(ip)) {
      continue;
    }
    output.push({ id, name, ip });
  }
  return output;
}

function sanitizeSettings(value) {
  const input = value ?? {};
  return {
    runsPerMode: clampInt(input.runsPerMode, 1, 200, 20),
    warmupCount: clampInt(input.warmupCount, 0, 20, 2),
    timeoutMs: clampInt(input.timeoutMs, 100, 10000, 2000),
    randomLabelLength: clampInt(input.randomLabelLength, 4, 30, 12),
    cachedDomains: sanitizeDomainList(input.cachedDomains, DEFAULT_CACHED_DOMAINS),
    uncachedBaseDomains: sanitizeDomainList(
      input.uncachedBaseDomains,
      DEFAULT_UNCACHED_BASE_DOMAINS
    )
  };
}

function sanitizeDomainList(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const domains = value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter((item) => item.length > 0 && isValidDomain(item));
  return domains.length > 0 ? domains : fallback;
}

function isValidDomain(domain) {
  if (domain.length > 253) {
    return false;
  }
  const labels = domain.split(".");
  if (labels.length < 2) {
    return false;
  }
  return labels.every((label) => /^[a-z0-9-]{1,63}$/.test(label) && !label.startsWith("-") && !label.endsWith("-"));
}

function isValidIPv4(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  const int = Math.trunc(number);
  if (int < min) {
    return min;
  }
  if (int > max) {
    return max;
  }
  return int;
}

function throwIfAborted(signal) {
  if (signal.aborted) {
    throw new Error("Operation aborted");
  }
}

async function runProviderBenchmark({ provider, settings, signal, onSample }) {
  const modeStats = {
    cached: createModeSummary(),
    uncached: createModeSummary()
  };

  for (const mode of MODES) {
    throwIfAborted(signal);
    const domainList = mode === "cached" ? settings.cachedDomains : settings.uncachedBaseDomains;
    let modeProgress = 0;

    for (const baseDomain of domainList) {
      for (let warmup = 0; warmup < settings.warmupCount; warmup += 1) {
        const warmupDomain =
          mode === "cached"
            ? baseDomain
            : `${randomLabel(settings.randomLabelLength)}.${baseDomain}`;
        try {
          await measureDnsQuery({
            serverIp: provider.ip,
            domain: warmupDomain,
            timeoutMs: settings.timeoutMs,
            signal
          });
        } catch {
          continue;
        }
      }

      for (let index = 0; index < settings.runsPerMode; index += 1) {
        throwIfAborted(signal);
        modeProgress += 1;
        const queryDomain =
          mode === "cached"
            ? baseDomain
            : `${randomLabel(settings.randomLabelLength)}.${baseDomain}`;

        try {
          const result = await measureDnsQuery({
            serverIp: provider.ip,
            domain: queryDomain,
            timeoutMs: settings.timeoutMs,
            signal
          });
          updateModeStats(modeStats[mode], baseDomain, result.latencyMs, true);
          onSample({
            type: "sample",
            mode,
            i: modeProgress,
            domainI: index + 1,
            domainTotal: settings.runsPerMode,
            ok: true,
            latencyMs: round2(result.latencyMs),
            baseDomain,
            domain: queryDomain
          });
        } catch (error) {
          updateModeStats(modeStats[mode], baseDomain, 0, false);
          const message = normalizeError(error);
          onSample({
            type: "sample",
            mode,
            i: modeProgress,
            domainI: index + 1,
            domainTotal: settings.runsPerMode,
            ok: false,
            error: message,
            baseDomain,
            domain: queryDomain
          });
        }
      }
    }
  }

  const cachedTotalRuns = settings.runsPerMode * settings.cachedDomains.length;
  const uncachedTotalRuns = settings.runsPerMode * settings.uncachedBaseDomains.length;
  const cached = finalizeModeSummary(modeStats.cached, cachedTotalRuns, settings.runsPerMode);
  const uncached = finalizeModeSummary(modeStats.uncached, uncachedTotalRuns, settings.runsPerMode);
  const scoreMs =
    Number.isFinite(cached.medianMs) && Number.isFinite(uncached.medianMs)
      ? round2((cached.medianMs + uncached.medianMs) / 2)
      : null;
  const p90Avg =
    Number.isFinite(cached.p90Ms) && Number.isFinite(uncached.p90Ms)
      ? round2((cached.p90Ms + uncached.p90Ms) / 2)
      : null;
  const meanAvg =
    Number.isFinite(cached.meanMs) && Number.isFinite(uncached.meanMs)
      ? round2((cached.meanMs + uncached.meanMs) / 2)
      : null;
  const successAvg = round2((cached.successRate + uncached.successRate) / 2);

  return {
    providerId: provider.id,
    providerName: provider.name,
    ip: provider.ip,
    cached,
    uncached,
    scoreMs,
    p90Avg,
    meanAvg,
    successAvg
  };
}

function randomLabel(length) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    result += alphabet[randomIndex];
  }
  return result;
}

function normalizeError(error) {
  if (error && typeof error === "object" && "code" in error && error.code === "TIMEOUT") {
    return "timeout";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "query failed";
}

function createModeSummary() {
  return {
    latencies: [],
    okCount: 0,
    failCount: 0,
    perDomain: {}
  };
}

function updateModeStats(modeSummary, baseDomain, latencyMs, ok) {
  const perDomainSummary = ensurePerDomainSummary(modeSummary, baseDomain);
  if (ok) {
    modeSummary.latencies.push(latencyMs);
    modeSummary.okCount += 1;
    perDomainSummary.latencies.push(latencyMs);
    perDomainSummary.okCount += 1;
    return;
  }
  modeSummary.failCount += 1;
  perDomainSummary.failCount += 1;
}

function ensurePerDomainSummary(modeSummary, baseDomain) {
  if (!modeSummary.perDomain[baseDomain]) {
    modeSummary.perDomain[baseDomain] = {
      latencies: [],
      okCount: 0,
      failCount: 0
    };
  }
  return modeSummary.perDomain[baseDomain];
}

function finalizeModeSummary(summary, totalRuns, runsPerDomain) {
  const latencies = summary.latencies.slice().sort((left, right) => left - right);
  const perDomain = {};
  for (const [baseDomain, domainSummary] of Object.entries(summary.perDomain)) {
    const domainLatencies = domainSummary.latencies.slice().sort((left, right) => left - right);
    perDomain[baseDomain] = {
      totalRuns: runsPerDomain,
      successCount: domainSummary.okCount,
      failureCount: domainSummary.failCount,
      successRate: totalRuns > 0 ? round2((domainSummary.okCount / runsPerDomain) * 100) : 0,
      medianMs: percentile(domainLatencies, 0.5),
      meanMs: mean(domainLatencies),
      p90Ms: percentile(domainLatencies, 0.9),
      minMs: domainLatencies.length > 0 ? round2(domainLatencies[0]) : null,
      maxMs: domainLatencies.length > 0 ? round2(domainLatencies[domainLatencies.length - 1]) : null
    };
  }

  return {
    totalRuns,
    successCount: summary.okCount,
    failureCount: summary.failCount,
    successRate: totalRuns > 0 ? round2((summary.okCount / totalRuns) * 100) : 0,
    medianMs: percentile(latencies, 0.5),
    meanMs: mean(latencies),
    p90Ms: percentile(latencies, 0.9),
    minMs: latencies.length > 0 ? round2(latencies[0]) : null,
    maxMs: latencies.length > 0 ? round2(latencies[latencies.length - 1]) : null,
    perDomain
  };
}

function mean(values) {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return round2(sum / values.length);
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) {
    return null;
  }
  const position = (sortedValues.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) {
    return round2(sortedValues[low]);
  }
  const weight = position - low;
  const value = sortedValues[low] * (1 - weight) + sortedValues[high] * weight;
  return round2(value);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function measureDnsQuery({ serverIp, domain, timeoutMs, signal }) {
  throwIfAborted(signal);

  const socket = dgram.createSocket("udp4");
  const txId = Math.floor(Math.random() * 65535);
  const queryPacket = buildDnsQuery(domain, txId);
  const startedAt = performance.now();

  return await new Promise((resolve, reject) => {
    let done = false;
    let timeoutRef;

    function finish(err, value) {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timeoutRef);
      socket.removeAllListeners();
      socket.close();
      signal.removeEventListener("abort", onAbort);
      if (err) {
        reject(err);
        return;
      }
      resolve(value);
    }

    function onAbort() {
      finish(new Error("aborted"));
    }

    timeoutRef = setTimeout(() => {
      const error = new Error("timeout");
      error.code = "TIMEOUT";
      finish(error);
    }, timeoutMs);

    signal.addEventListener("abort", onAbort, { once: true });

    socket.on("error", (error) => finish(error));
    socket.on("message", (message) => {
      if (message.length < 2) {
        return;
      }
      const responseTxId = message.readUInt16BE(0);
      if (responseTxId !== txId) {
        return;
      }
      const latencyMs = performance.now() - startedAt;
      finish(null, { latencyMs });
    });

    socket.send(queryPacket, 53, serverIp, (error) => {
      if (error) {
        finish(error);
      }
    });
  });
}

function buildDnsQuery(domain, txId) {
  const labels = domain.split(".");
  const questionLength = labels.reduce((sum, label) => sum + 1 + label.length, 0) + 1 + 2 + 2;
  const buffer = Buffer.alloc(12 + questionLength);

  buffer.writeUInt16BE(txId, 0);
  buffer.writeUInt16BE(0x0100, 2);
  buffer.writeUInt16BE(1, 4);
  buffer.writeUInt16BE(0, 6);
  buffer.writeUInt16BE(0, 8);
  buffer.writeUInt16BE(0, 10);

  let offset = 12;
  for (const label of labels) {
    buffer.writeUInt8(label.length, offset);
    offset += 1;
    buffer.write(label, offset, "ascii");
    offset += label.length;
  }
  buffer.writeUInt8(0, offset);
  offset += 1;
  buffer.writeUInt16BE(1, offset);
  offset += 2;
  buffer.writeUInt16BE(1, offset);

  return buffer;
}
