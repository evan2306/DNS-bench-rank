<template>
  <div class="app-shell">
    <header class="hero">
      <p class="kicker">DNS 測速儀表板</p>
      <h1>以快取與非快取測試 DNS 解析速度排名</h1>
      <p class="hero-note">
        本工具從你的電腦直接量測 UDP/53 延遲。結果會受網路路由、ISP 政策與測試時段影響。
      </p>
    </header>

    <section class="panel controls-panel">
      <div class="actions">
        <button class="btn btn-primary" :disabled="!canStart" @click="startRun">開始測試</button>
        <button class="btn btn-warn" :disabled="!running" @click="stopRun">停止</button>
        <button class="btn btn-soft" :disabled="running" @click="resetRun">重設結果</button>
      </div>
      <div class="run-meta">
        <span>已選擇：{{ selectedProviderIds.length }} 台</span>
        <span v-if="runId">測試編號：{{ runId }}</span>
        <span v-if="globalError" class="error-text">{{ globalError }}</span>
      </div>
    </section>

    <div class="main-grid">
      <section class="panel">
        <h2>DNS 名單</h2>
        <p class="panel-tip">可勾選要測試的解析器，並新增自訂 IPv4 目標。</p>
        <div class="provider-actions">
          <button class="mini-btn" @click="selectAll" :disabled="running">全選</button>
          <button class="mini-btn" @click="clearSelection" :disabled="running">清除</button>
        </div>
        <div class="provider-list">
          <label v-for="provider in allProviders" :key="provider.id" class="provider-item">
            <input
              type="checkbox"
              :value="provider.id"
              v-model="selectedProviderIds"
              :disabled="running"
            />
            <span>{{ provider.name }}</span>
            <code>{{ provider.ip }}</code>
            <button
              v-if="!provider.builtin"
              class="delete-btn"
              :disabled="running"
              @click.prevent="removeCustomProvider(provider.id)"
            >
              刪除
            </button>
          </label>
        </div>

        <form class="custom-form" @submit.prevent="addCustomProvider">
          <h3>新增自訂 DNS</h3>
          <input v-model.trim="newProviderName" :disabled="running" type="text" placeholder="名稱" />
          <input v-model.trim="newProviderIp" :disabled="running" type="text" placeholder="IPv4" />
          <button class="btn btn-soft" :disabled="running" type="submit">新增</button>
          <p v-if="providerError" class="error-text">{{ providerError }}</p>
        </form>
      </section>

      <section class="panel settings-panel">
        <h2>測試設定</h2>
        <p class="panel-tip">這些參數會儲存在瀏覽器的 localStorage。</p>
        <div class="settings-grid">
          <label>
            <span class="field-title">
              每種模式次數
              <span
                class="info-icon"
                tabindex="0"
                role="img"
                aria-label="說明：每種模式次數"
                data-tip="每個網域在每種模式要跑幾次。若快取網域有 6 筆且填 10，快取模式總測試數就是 60。"
              >
                i
              </span>
            </span>
            <input v-model.number="settings.runsPerMode" :disabled="running" type="number" min="1" max="200" />
          </label>
          <label>
            <span class="field-title">
              預熱次數
              <span
                class="info-icon"
                tabindex="0"
                role="img"
                aria-label="說明：預熱次數"
                data-tip="正式計分前先送幾次查詢，讓連線與快取進入穩定狀態。一般填 1-3。"
              >
                i
              </span>
            </span>
            <input v-model.number="settings.warmupCount" :disabled="running" type="number" min="0" max="20" />
          </label>
          <label>
            <span class="field-title">
              逾時時間（ms）
              <span
                class="info-icon"
                tabindex="0"
                role="img"
                aria-label="說明：逾時時間"
                data-tip="單次 DNS 查詢最長等待毫秒數。建議 800-2000；網路較差可調高。"
              >
                i
              </span>
            </span>
            <input v-model.number="settings.timeoutMs" :disabled="running" type="number" min="100" max="10000" />
          </label>
          <label>
            <span class="field-title">
              隨機子網域長度
              <span
                class="info-icon"
                tabindex="0"
                role="img"
                aria-label="說明：隨機子網域長度"
                data-tip="非快取模式會產生隨機前綴。長度越長越不容易命中快取，建議 8-12。"
              >
                i
              </span>
            </span>
            <input
              v-model.number="settings.randomLabelLength"
              :disabled="running"
              type="number"
              min="4"
              max="30"
            />
          </label>
        </div>

        <div class="textareas">
          <label>
            <span class="field-title">
              快取測試網域清單
              <span
                class="info-icon"
                tabindex="0"
                role="img"
                aria-label="說明：快取測試網域"
                data-tip="輸入網域後按＋加入清單，建議 3-10 筆可解析網域，例如 example.com。"
              >
                i
              </span>
            </span>
            <div class="domain-editor">
              <div class="domain-add-row">
                <input
                  v-model.trim="cachedDomainInput"
                  :disabled="running"
                  type="text"
                  placeholder="例如 example.com"
                  @keyup.enter.prevent="addCachedDomain"
                />
                <button class="mini-btn" type="button" :disabled="running" @click="addCachedDomain">＋</button>
              </div>
              <p class="field-subtitle">已加入 {{ settings.cachedDomains.length }} 筆</p>
              <div class="domain-list">
                <div v-for="(domain, index) in settings.cachedDomains" :key="`${domain}-${index}`" class="domain-item">
                  <template v-if="editingCachedDomainIndex === index">
                    <input
                      v-model.trim="editingCachedDomainValue"
                      :disabled="running"
                      type="text"
                      class="domain-item-input"
                    />
                    <button class="mini-btn" type="button" :disabled="running" @click="saveCachedDomainEdit(index)">
                      儲存
                    </button>
                    <button class="mini-btn" type="button" :disabled="running" @click="cancelCachedDomainEdit">
                      取消
                    </button>
                  </template>
                  <template v-else>
                    <code>{{ domain }}</code>
                    <button class="mini-btn" type="button" :disabled="running" @click="startCachedDomainEdit(index)">
                      編輯
                    </button>
                    <button class="mini-btn" type="button" :disabled="running" @click="removeCachedDomain(index)">
                      刪除
                    </button>
                  </template>
                </div>
              </div>
              <p v-if="cachedDomainError" class="error-text">{{ cachedDomainError }}</p>
            </div>
          </label>
          <label>
            <span class="field-title">
              非快取基底網域（每行一筆）
              <span
                class="info-icon"
                tabindex="0"
                role="img"
                aria-label="說明：非快取基底網域"
                data-tip="系統會在前面加隨機子網域來降低快取命中率，一行一個基底網域。"
              >
                i
              </span>
            </span>
            <textarea v-model="settings.uncachedBaseDomainsText" :disabled="running" rows="6"></textarea>
          </label>
        </div>
      </section>
    </div>

    <section class="panel">
      <h2>測試結果</h2>
      <ResultsTable :rows="tableRows" />
    </section>

    <section class="panel">
      <h2>快取網域逐項結果</h2>
      <p class="panel-tip">每個快取網域獨立測試，分開顯示各 DNS 的中位數、平均值與成功率。</p>
      <div class="domain-matrix-wrap">
        <table class="domain-matrix">
          <thead>
            <tr>
              <th>DNS</th>
              <th v-for="domain in settings.cachedDomains" :key="domain">{{ domain }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in cachedDomainMatrixRows" :key="row.id">
              <td class="domain-matrix-provider">
                {{ row.rankLabel }} {{ row.name }}
              </td>
              <td v-for="cell in row.cells" :key="`${row.id}-${cell.domain}`">
                <div class="domain-cell">
                  <div class="domain-cell-main">中位：{{ formatDomainMs(cell.medianMs) }}</div>
                  <div class="domain-cell-sub">平均：{{ formatDomainMs(cell.meanMs) }}</div>
                  <div class="domain-cell-sub">
                    {{ cell.successCount }}/{{ cell.totalRuns }}（{{ formatPercentShort(cell.successRate) }}）
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>快取網域綜合分數排行</h2>
      <p class="panel-tip">每個快取網域獨立排名。分數 = 中位數(ms) × (100 / 成功率%)，越低越快越穩。</p>
      <div class="domain-rank-grid">
        <article v-for="item in cachedDomainScoreRankings" :key="item.domain" class="domain-rank-card">
          <h3>{{ item.domain }}</h3>
          <p v-if="item.rows.length === 0" class="field-subtitle">尚無可排名資料</p>
          <table v-else class="domain-rank-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>DNS</th>
                <th>分數</th>
                <th>中位數</th>
                <th>平均值</th>
                <th>成功率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in item.rows" :key="row.providerId">
                <td>#{{ row.rank }}</td>
                <td>{{ row.name }}</td>
                <td>{{ formatDomainScore(row.scoreMs) }}</td>
                <td>{{ formatDomainMs(row.medianMs) }}</td>
                <td>{{ formatDomainMs(row.meanMs) }}</td>
                <td>{{ formatPercentShort(row.successRate) }}</td>
              </tr>
            </tbody>
          </table>
        </article>
      </div>
    </section>

    <section class="panel">
      <ScoreChart :rows="tableRows" />
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import ResultsTable from "./components/ResultsTable.vue";
import ScoreChart from "./components/ScoreChart.vue";
import { streamBenchmark } from "./lib/benchmarkClient";
import { mean, median, percentile, round2 } from "./lib/stats";
import {
  loadCustomProviders,
  loadSelectedProviderIds,
  loadSettings,
  saveCustomProviders,
  saveSelectedProviderIds,
  saveSettings
} from "./lib/storage";
import { DEFAULT_PROVIDERS } from "./providers";

const fallbackSettings = {
  runsPerMode: 20,
  warmupCount: 2,
  timeoutMs: 2000,
  randomLabelLength: 12,
  cachedDomains: ["google.com", "youtube.com", "netflix.com", "tw.yahoo.com", "pchome.com.tw", "momo.com.tw"],
  uncachedBaseDomainsText: ["google.com", "youtube.com", "netflix.com", "wikipedia.org", "github.com"].join("\n")
};

const customProviders = ref(loadCustomProvidersSafe());
const selectedProviderIds = ref(loadSelectedProviderIdsSafe());
const loadedSettings = loadSettings() || {};
const settings = reactive({
  runsPerMode: clampInt(loadedSettings.runsPerMode, 1, 200, fallbackSettings.runsPerMode),
  warmupCount: clampInt(loadedSettings.warmupCount, 0, 20, fallbackSettings.warmupCount),
  timeoutMs: clampInt(loadedSettings.timeoutMs, 100, 10000, fallbackSettings.timeoutMs),
  randomLabelLength: clampInt(loadedSettings.randomLabelLength, 4, 30, fallbackSettings.randomLabelLength),
  cachedDomains: normalizeDomainList(
    loadedSettings.cachedDomains,
    loadedSettings.cachedDomainsText,
    fallbackSettings.cachedDomains
  ),
  uncachedBaseDomainsText: normalizeDomainText(
    loadedSettings.uncachedBaseDomainsText,
    fallbackSettings.uncachedBaseDomainsText
  )
});

const running = ref(false);
const runId = ref("");
const globalError = ref("");
const providerError = ref("");
const cachedDomainError = ref("");
const cachedDomainInput = ref("");
const editingCachedDomainIndex = ref(-1);
const editingCachedDomainValue = ref("");
const newProviderName = ref("");
const newProviderIp = ref("");
const benchmarkController = ref(null);
const resultsByProviderId = reactive({});

const allProviders = computed(() => [...DEFAULT_PROVIDERS, ...customProviders.value]);

const selectedProviders = computed(() => {
  const selectedSet = new Set(selectedProviderIds.value);
  return allProviders.value.filter((item) => selectedSet.has(item.id));
});

const canStart = computed(() => {
  if (running.value) {
    return false;
  }
  if (selectedProviders.value.length === 0) {
    return false;
  }
  return settings.cachedDomains.length > 0 && getDomainsFromText(settings.uncachedBaseDomainsText).length > 0;
});

const tableRows = computed(() => {
  const rows = allProviders.value.map((provider) => {
    const resultState = ensureResultState(provider.id);
    const cachedStats = resolveModeStats(resultState, "cached");
    const uncachedStats = resolveModeStats(resultState, "uncached");
    const scoreMs =
      Number.isFinite(cachedStats.medianMs) && Number.isFinite(uncachedStats.medianMs)
        ? round2((cachedStats.medianMs + uncachedStats.medianMs) / 2)
        : null;
    const p90Avg =
      Number.isFinite(cachedStats.p90Ms) && Number.isFinite(uncachedStats.p90Ms)
        ? round2((cachedStats.p90Ms + uncachedStats.p90Ms) / 2)
        : null;
    const successAvg =
      Number.isFinite(cachedStats.successRate) && Number.isFinite(uncachedStats.successRate)
        ? round2((cachedStats.successRate + uncachedStats.successRate) / 2)
        : null;
    const meanAvg =
      Number.isFinite(cachedStats.meanMs) && Number.isFinite(uncachedStats.meanMs)
        ? round2((cachedStats.meanMs + uncachedStats.meanMs) / 2)
        : null;

    const cachedDone = resultState.progress.cachedDone;
    const uncachedDone = resultState.progress.uncachedDone;
    const cachedTotal = resultState.progress.cachedTotal;
    const uncachedTotal = resultState.progress.uncachedTotal;
    return {
      id: provider.id,
      name: provider.name,
      ip: provider.ip,
      selected: selectedProviderIds.value.includes(provider.id),
      status: resultState.status,
      progressText: `${cachedDone}/${cachedTotal} | ${uncachedDone}/${uncachedTotal}`,
      cachedMedian: cachedStats.medianMs,
      cachedMean: cachedStats.meanMs,
      uncachedMedian: uncachedStats.medianMs,
      uncachedMean: uncachedStats.meanMs,
      scoreMs,
      p90Avg,
      meanAvg,
      successAvg,
      lastError: resultState.lastError
    };
  });

  const ranked = rows
    .filter((item) => Number.isFinite(item.scoreMs))
    .sort((left, right) => {
      if (left.scoreMs !== right.scoreMs) {
        return left.scoreMs - right.scoreMs;
      }
      if ((left.p90Avg ?? Number.POSITIVE_INFINITY) !== (right.p90Avg ?? Number.POSITIVE_INFINITY)) {
        return (left.p90Avg ?? Number.POSITIVE_INFINITY) - (right.p90Avg ?? Number.POSITIVE_INFINITY);
      }
      if ((left.successAvg ?? -1) !== (right.successAvg ?? -1)) {
        return (right.successAvg ?? -1) - (left.successAvg ?? -1);
      }
      return left.name.localeCompare(right.name);
    });

  const rankMap = new Map();
  ranked.forEach((item, index) => {
    rankMap.set(item.id, index + 1);
  });

  return rows
    .map((item) => ({ ...item, rank: rankMap.get(item.id) ?? null }))
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return left.name.localeCompare(right.name);
    });
});

const cachedDomainMatrixRows = computed(() => {
  const selectedSet = new Set(selectedProviderIds.value);
  const domains = settings.cachedDomains;
  return tableRows.value
    .filter((row) => selectedSet.has(row.id))
    .map((row) => {
      const cells = domains.map((domain) => ({
        domain,
        ...resolveCachedDomainStats(row.id, domain)
      }));
      return {
        id: row.id,
        name: row.name,
        rankLabel: row.rank ? `#${row.rank}` : "—",
        cells
      };
    });
});

const cachedDomainScoreRankings = computed(() => {
  const selectedSet = new Set(selectedProviderIds.value);
  const targetProviders = allProviders.value.filter((provider) => selectedSet.has(provider.id));

  return settings.cachedDomains.map((domain) => {
    const rankedRows = targetProviders
      .map((provider) => {
        const stats = resolveCachedDomainStats(provider.id, domain);
        const scoreMs = calcDomainScore(stats.medianMs, stats.successRate);
        return {
          providerId: provider.id,
          name: provider.name,
          medianMs: stats.medianMs,
          meanMs: stats.meanMs,
          successRate: stats.successRate,
          scoreMs
        };
      })
      .filter((item) => Number.isFinite(item.scoreMs))
      .sort((left, right) => {
        if (left.scoreMs !== right.scoreMs) {
          return left.scoreMs - right.scoreMs;
        }
        if ((right.successRate ?? -1) !== (left.successRate ?? -1)) {
          return (right.successRate ?? -1) - (left.successRate ?? -1);
        }
        if ((left.medianMs ?? Number.POSITIVE_INFINITY) !== (right.medianMs ?? Number.POSITIVE_INFINITY)) {
          return (left.medianMs ?? Number.POSITIVE_INFINITY) - (right.medianMs ?? Number.POSITIVE_INFINITY);
        }
        return left.name.localeCompare(right.name);
      })
      .map((row, index) => ({ ...row, rank: index + 1 }));

    return {
      domain,
      rows: rankedRows
    };
  });
});

watch(
  customProviders,
  (value) => {
    saveCustomProviders(value);
  },
  { deep: true }
);

watch(
  selectedProviderIds,
  (value) => {
    saveSelectedProviderIds(value);
  },
  { deep: true }
);

watch(
  allProviders,
  (providers) => {
    const validIds = new Set(providers.map((item) => item.id));
    const filteredIds = selectedProviderIds.value.filter((id) => validIds.has(id));
    if (filteredIds.length !== selectedProviderIds.value.length) {
      selectedProviderIds.value = filteredIds;
    }
  },
  { deep: true }
);

watch(
  settings,
  (value) => {
    saveSettings(value);
  },
  { deep: true }
);

if (selectedProviderIds.value.length === 0) {
  selectedProviderIds.value = allProviders.value.map((item) => item.id);
}

function ensureResultState(providerId) {
  if (!resultsByProviderId[providerId]) {
    resultsByProviderId[providerId] = {
      status: "idle",
      progress: {
        cachedDone: 0,
        uncachedDone: 0,
        cachedTotal: clampInt(settings.runsPerMode, 1, 200, 20) * settings.cachedDomains.length,
        uncachedTotal: clampInt(settings.runsPerMode, 1, 200, 20) * getDomainsFromText(settings.uncachedBaseDomainsText).length
      },
      samples: {
        cached: [],
        uncached: []
      },
      domainSamples: {
        cached: {},
        uncached: {}
      },
      failCounts: {
        cached: 0,
        uncached: 0
      },
      summary: null,
      lastError: ""
    };
  }
  return resultsByProviderId[providerId];
}

function resetRun() {
  runId.value = "";
  globalError.value = "";
  for (const key of Object.keys(resultsByProviderId)) {
    delete resultsByProviderId[key];
  }
}

function stopRun() {
  if (!benchmarkController.value) {
    return;
  }
  benchmarkController.value.abort();
}

async function startRun() {
  globalError.value = "";
  providerError.value = "";
  cachedDomainError.value = "";

  const cachedDomains = settings.cachedDomains.slice();
  const uncachedBaseDomains = getDomainsFromText(settings.uncachedBaseDomainsText);
  const runsPerMode = clampInt(settings.runsPerMode, 1, 200, 20);
  const cachedTotal = runsPerMode * cachedDomains.length;
  const uncachedTotal = runsPerMode * uncachedBaseDomains.length;
  if (cachedDomains.length === 0 || uncachedBaseDomains.length === 0) {
    globalError.value = "網域清單不可為空。";
    return;
  }

  running.value = true;
  runId.value = "";
  for (const key of Object.keys(resultsByProviderId)) {
    delete resultsByProviderId[key];
  }

  for (const provider of selectedProviders.value) {
    const state = ensureResultState(provider.id);
    state.status = "idle";
    state.progress.cachedDone = 0;
    state.progress.uncachedDone = 0;
    state.progress.cachedTotal = cachedTotal;
    state.progress.uncachedTotal = uncachedTotal;
    state.samples.cached = [];
    state.samples.uncached = [];
    state.domainSamples.cached = {};
    state.domainSamples.uncached = {};
    state.failCounts.cached = 0;
    state.failCounts.uncached = 0;
    state.summary = null;
    state.lastError = "";
  }

  const payload = {
    providers: selectedProviders.value.map((item) => ({
      id: item.id,
      name: item.name,
      ip: item.ip
    })),
    settings: {
      runsPerMode,
      warmupCount: clampInt(settings.warmupCount, 0, 20, 2),
      timeoutMs: clampInt(settings.timeoutMs, 100, 10000, 2000),
      randomLabelLength: clampInt(settings.randomLabelLength, 4, 30, 12),
      cachedDomains,
      uncachedBaseDomains
    }
  };

  const controller = new AbortController();
  benchmarkController.value = controller;

  try {
    await streamBenchmark({
      providers: payload.providers,
      settings: payload.settings,
      signal: controller.signal,
      onEvent: handleEvent
    });
  } catch (error) {
    if (controller.signal.aborted) {
      for (const provider of selectedProviders.value) {
        const state = ensureResultState(provider.id);
        if (state.status === "running" || state.status === "idle") {
          state.status = "stopped";
        }
      }
    } else {
      globalError.value = error instanceof Error ? toZhError(error.message) : "測試失敗";
      for (const provider of selectedProviders.value) {
        const state = ensureResultState(provider.id);
        if (state.status === "running" || state.status === "idle") {
          state.status = "error";
        }
      }
    }
  } finally {
    running.value = false;
    benchmarkController.value = null;
  }
}

function handleEvent(event) {
  if (event.type === "run-start") {
    runId.value = event.runId;
    return;
  }
  if (event.type === "run-error") {
    globalError.value = toZhError(event.message || "測試發生錯誤");
    for (const provider of selectedProviders.value) {
      const state = ensureResultState(provider.id);
      if (state.status === "running" || state.status === "idle") {
        state.status = "error";
      }
    }
    return;
  }
  if (event.type === "provider-start") {
    const state = ensureResultState(event.providerId);
    state.status = "running";
    return;
  }
  if (event.type === "sample") {
    const state = ensureResultState(event.providerId);
    state.status = "running";
    const domainKey = event.baseDomain || event.domain;
    const domainBucket = ensureDomainBucket(state, event.mode, domainKey);
    domainBucket.totalCount += 1;
    if (event.ok) {
      state.samples[event.mode].push(event.latencyMs);
      domainBucket.latencies.push(event.latencyMs);
      domainBucket.successCount += 1;
    } else {
      state.failCounts[event.mode] += 1;
      state.lastError = toZhError(event.error || "query failed");
      domainBucket.failCount += 1;
    }
    if (event.mode === "cached") {
      state.progress.cachedDone = Math.max(state.progress.cachedDone, event.i);
    } else {
      state.progress.uncachedDone = Math.max(state.progress.uncachedDone, event.i);
    }
    return;
  }
  if (event.type === "provider-done") {
    const state = ensureResultState(event.providerId);
    state.status = "done";
    state.summary = event.summary;
    return;
  }
  if (event.type === "run-stopped") {
    for (const provider of selectedProviders.value) {
      const state = ensureResultState(provider.id);
      if (state.status === "running") {
        state.status = "stopped";
      }
    }
    return;
  }
}

function resolveModeStats(resultState, mode) {
  if (resultState.summary && resultState.summary[mode]) {
    const fallbackMean = mean(resultState.samples[mode]);
    return {
      medianMs: resultState.summary[mode].medianMs,
      meanMs: resultState.summary[mode].meanMs ?? fallbackMean,
      p90Ms: resultState.summary[mode].p90Ms,
      successRate: resultState.summary[mode].successRate
    };
  }
  const latencies = resultState.samples[mode];
  const done = mode === "cached" ? resultState.progress.cachedDone : resultState.progress.uncachedDone;
  const total = mode === "cached" ? resultState.progress.cachedTotal : resultState.progress.uncachedTotal;
  const successCount = latencies.length;
  const successRate = done > 0 ? round2((successCount / total) * 100) : null;
  return {
    medianMs: median(latencies),
    meanMs: mean(latencies),
    p90Ms: percentile(latencies, 0.9),
    successRate
  };
}

function resolveCachedDomainStats(providerId, domain) {
  const state = ensureResultState(providerId);
  const summary = state.summary?.cached?.perDomain?.[domain];
  if (summary) {
    const fallbackMean = mean(state.domainSamples.cached[domain]?.latencies || []);
    return {
      totalRuns: summary.totalRuns,
      successCount: summary.successCount,
      successRate: summary.successRate,
      medianMs: summary.medianMs,
      meanMs: summary.meanMs ?? fallbackMean
    };
  }

  const bucket = state.domainSamples.cached[domain];
  if (!bucket) {
    return {
      totalRuns: clampInt(settings.runsPerMode, 1, 200, 20),
      successCount: 0,
      successRate: null,
      medianMs: null,
      meanMs: null
    };
  }

  return {
    totalRuns: clampInt(settings.runsPerMode, 1, 200, 20),
    successCount: bucket.successCount,
    successRate: bucket.totalCount > 0 ? round2((bucket.successCount / bucket.totalCount) * 100) : null,
    medianMs: median(bucket.latencies),
    meanMs: mean(bucket.latencies)
  };
}

function ensureDomainBucket(state, mode, domainKey) {
  if (!state.domainSamples[mode][domainKey]) {
    state.domainSamples[mode][domainKey] = {
      latencies: [],
      successCount: 0,
      failCount: 0,
      totalCount: 0
    };
  }
  return state.domainSamples[mode][domainKey];
}

function getDomainsFromText(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0)
    .filter((item) => isLikelyDomain(item));
}

function addCachedDomain() {
  cachedDomainError.value = "";
  const normalizedDomain = normalizeDomain(cachedDomainInput.value);
  if (!normalizedDomain) {
    cachedDomainError.value = "請輸入有效網域，例如 example.com。";
    return;
  }
  if (settings.cachedDomains.includes(normalizedDomain)) {
    cachedDomainError.value = "此網域已在清單中。";
    return;
  }
  settings.cachedDomains.push(normalizedDomain);
  cachedDomainInput.value = "";
}

function startCachedDomainEdit(index) {
  cachedDomainError.value = "";
  editingCachedDomainIndex.value = index;
  editingCachedDomainValue.value = settings.cachedDomains[index];
}

function cancelCachedDomainEdit() {
  editingCachedDomainIndex.value = -1;
  editingCachedDomainValue.value = "";
  cachedDomainError.value = "";
}

function saveCachedDomainEdit(index) {
  cachedDomainError.value = "";
  const normalizedDomain = normalizeDomain(editingCachedDomainValue.value);
  if (!normalizedDomain) {
    cachedDomainError.value = "請輸入有效網域，例如 example.com。";
    return;
  }
  const hasDuplicate = settings.cachedDomains.some(
    (domain, itemIndex) => itemIndex !== index && domain === normalizedDomain
  );
  if (hasDuplicate) {
    cachedDomainError.value = "此網域已在清單中。";
    return;
  }
  settings.cachedDomains[index] = normalizedDomain;
  cancelCachedDomainEdit();
}

function removeCachedDomain(index) {
  settings.cachedDomains.splice(index, 1);
  if (editingCachedDomainIndex.value === index) {
    cancelCachedDomainEdit();
    return;
  }
  if (editingCachedDomainIndex.value > index) {
    editingCachedDomainIndex.value -= 1;
  }
}

function normalizeDomain(value) {
  const domain = String(value || "").trim().toLowerCase();
  if (!isLikelyDomain(domain)) {
    return "";
  }
  return domain;
}

function isLikelyDomain(value) {
  if (value.length > 253) {
    return false;
  }
  const labels = value.split(".");
  if (labels.length < 2) {
    return false;
  }
  return labels.every((label) => /^[a-z0-9-]{1,63}$/.test(label) && !label.startsWith("-") && !label.endsWith("-"));
}

function clampInt(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const intValue = Math.trunc(numeric);
  if (intValue < min) {
    return min;
  }
  if (intValue > max) {
    return max;
  }
  return intValue;
}

function normalizeDomainText(value, fallback) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  return value;
}

function normalizeDomainList(listValue, textValue, fallback) {
  let source = [];
  if (Array.isArray(listValue)) {
    source = listValue;
  } else if (typeof textValue === "string") {
    source = getDomainsFromText(textValue);
  } else {
    source = fallback;
  }

  const normalized = source
    .map((item) => normalizeDomain(item))
    .filter((item) => item.length > 0);

  if (normalized.length === 0) {
    return fallback.slice();
  }
  return [...new Set(normalized)];
}

function loadCustomProvidersSafe() {
  const loaded = loadCustomProviders();
  if (!Array.isArray(loaded)) {
    return [];
  }
  return loaded.filter((item) => item && typeof item.id === "string" && isIPv4(item.ip));
}

function loadSelectedProviderIdsSafe() {
  const loaded = loadSelectedProviderIds();
  if (!Array.isArray(loaded)) {
    return [];
  }
  return loaded.filter((item) => typeof item === "string");
}

function isIPv4(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((item) => {
    if (!/^\d{1,3}$/.test(item)) {
      return false;
    }
    const numeric = Number(item);
    return numeric >= 0 && numeric <= 255;
  });
}

function selectAll() {
  selectedProviderIds.value = allProviders.value.map((item) => item.id);
}

function clearSelection() {
  selectedProviderIds.value = [];
}

function addCustomProvider() {
  providerError.value = "";
  const name = newProviderName.value.trim();
  const ip = newProviderIp.value.trim();
  if (!name) {
    providerError.value = "請輸入名稱。";
    return;
  }
  if (!isIPv4(ip)) {
    providerError.value = "IPv4 格式不正確。";
    return;
  }
  if (allProviders.value.some((item) => item.ip === ip && item.name.toLowerCase() === name.toLowerCase())) {
    providerError.value = "這筆 DNS 已存在。";
    return;
  }

  const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  customProviders.value.push({ id, name, ip, builtin: false });
  selectedProviderIds.value.push(id);
  newProviderName.value = "";
  newProviderIp.value = "";
}

function removeCustomProvider(providerId) {
  customProviders.value = customProviders.value.filter((item) => item.id !== providerId);
  selectedProviderIds.value = selectedProviderIds.value.filter((item) => item !== providerId);
  delete resultsByProviderId[providerId];
}

function toZhError(message) {
  const value = String(message || "");
  const lower = value.toLowerCase();
  if (lower === "timeout") {
    return "逾時";
  }
  if (lower === "aborted") {
    return "已中止";
  }
  if (lower === "query failed") {
    return "查詢失敗";
  }
  if (lower.includes("benchmark request failed")) {
    return "測試請求失敗";
  }
  if (lower.includes("no streaming body")) {
    return "伺服器未回傳串流資料";
  }
  if (lower.includes("invalid")) {
    return "參數格式錯誤";
  }
  return value;
}

function formatDomainMs(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value.toFixed(2)} ms`;
}

function formatPercentShort(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value.toFixed(0)}%`;
}

function calcDomainScore(medianMs, successRate) {
  if (!Number.isFinite(medianMs) || !Number.isFinite(successRate) || successRate <= 0) {
    return null;
  }
  return round2(medianMs * (100 / successRate));
}

function formatDomainScore(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value.toFixed(2)} 分`;
}
</script>
