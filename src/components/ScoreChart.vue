<template>
  <div class="chart-wrap">
    <div class="chart-head">
      <h3>綜合分數排行榜</h3>
      <p>分數越低越快（快取中位數 + 非快取中位數）/ 2</p>
    </div>
    <div class="bars">
      <div v-for="row in chartRows" :key="row.id" class="bar-row">
        <div class="bar-label">{{ row.rank }}. {{ row.name }}</div>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: `${row.width}%` }"></div>
          <span class="bar-value">{{ row.scoreMs.toFixed(2) }} ms</span>
        </div>
      </div>
      <p v-if="chartRows.length === 0" class="empty-tip">目前還沒有可排名結果。</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  rows: {
    type: Array,
    required: true
  }
});

const chartRows = computed(() => {
  const ranked = props.rows.filter((item) => Number.isFinite(item.scoreMs) && Number.isFinite(item.rank));
  if (ranked.length === 0) {
    return [];
  }
  const max = Math.max(...ranked.map((item) => item.scoreMs));
  const safeMax = max <= 0 ? 1 : max;
  return ranked.map((item) => ({
    id: item.id,
    name: item.name,
    rank: item.rank,
    scoreMs: item.scoreMs,
    width: Math.max((item.scoreMs / safeMax) * 100, 8)
  }));
});
</script>

<style scoped>
.chart-wrap {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  padding: 14px;
  background: rgba(5, 14, 24, 0.58);
}

.chart-head h3 {
  margin: 0;
  font-size: 18px;
}

.chart-head p {
  margin: 6px 0 12px;
  font-size: 13px;
  color: rgba(212, 226, 232, 0.8);
}

.bars {
  display: grid;
  gap: 10px;
}

.bar-row {
  display: grid;
  gap: 6px;
}

.bar-label {
  font-size: 13px;
}

.bar-track {
  position: relative;
  border-radius: 999px;
  height: 28px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: linear-gradient(90deg, #ffd166, #ff7f50);
}

.bar-value {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: #04111a;
  font-weight: 700;
}

.empty-tip {
  margin: 0;
  font-size: 13px;
  color: rgba(212, 226, 232, 0.8);
}
</style>
