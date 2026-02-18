export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = values.slice().sort((left, right) => left - right);
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) {
    return round2(sorted[low]);
  }
  const weight = position - low;
  return round2(sorted[low] * (1 - weight) + sorted[high] * weight);
}

export function median(values) {
  return percentile(values, 0.5);
}

export function mean(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return round2(sum / values.length);
}

export function round2(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
}
