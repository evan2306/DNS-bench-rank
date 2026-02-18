<template>
  <div class="table-wrap">
    <table class="results-table">
      <thead>
        <tr>
          <th>排名</th>
          <th>DNS 供應商</th>
          <th>IP</th>
          <th>狀態</th>
          <th>進度</th>
          <th>快取中位數</th>
          <th>快取平均值</th>
          <th>非快取中位數</th>
          <th>非快取平均值</th>
          <th>綜合分數</th>
          <th>成功率</th>
          <th>最後錯誤</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" :class="{ selected: row.selected }">
          <td>{{ row.rank ?? "—" }}</td>
          <td>{{ row.name }}</td>
          <td>{{ row.ip }}</td>
          <td>
            <span class="status-pill" :data-status="row.status">{{ formatStatus(row.status) }}</span>
          </td>
          <td>{{ row.progressText }}</td>
          <td>{{ formatMs(row.cachedMedian) }}</td>
          <td>{{ formatMs(row.cachedMean) }}</td>
          <td>{{ formatMs(row.uncachedMedian) }}</td>
          <td>{{ formatMs(row.uncachedMean) }}</td>
          <td>{{ formatMs(row.scoreMs) }}</td>
          <td>{{ formatPercent(row.successAvg) }}</td>
          <td class="error-cell">{{ row.lastError || "—" }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  rows: {
    type: Array,
    required: true
  }
});

function formatMs(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value.toFixed(2)} ms`;
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value.toFixed(1)}%`;
}

function formatStatus(status) {
  const map = {
    idle: "待命",
    running: "測試中",
    done: "完成",
    stopped: "已停止",
    error: "錯誤"
  };
  return map[status] || status;
}
</script>

<style scoped>
.table-wrap {
  overflow: auto;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.results-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 14px;
  background: rgba(4, 11, 20, 0.5);
}

.results-table th,
.results-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
  white-space: nowrap;
}

.results-table th {
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(214, 239, 246, 0.85);
}

.results-table tr.selected {
  background: rgba(3, 131, 135, 0.15);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  text-transform: capitalize;
  border: 1px solid transparent;
}

.status-pill[data-status="done"] {
  background: rgba(26, 186, 118, 0.2);
  border-color: rgba(26, 186, 118, 0.4);
}

.status-pill[data-status="running"] {
  background: rgba(241, 173, 38, 0.22);
  border-color: rgba(241, 173, 38, 0.42);
}

.status-pill[data-status="stopped"] {
  background: rgba(194, 122, 17, 0.22);
  border-color: rgba(194, 122, 17, 0.42);
}

.status-pill[data-status="error"] {
  background: rgba(232, 71, 108, 0.22);
  border-color: rgba(232, 71, 108, 0.45);
}

.status-pill[data-status="idle"] {
  background: rgba(114, 132, 145, 0.18);
  border-color: rgba(114, 132, 145, 0.36);
}

.error-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
