<script setup lang="ts">
import MetricCard from "@/components/MetricCard.vue";
import { usePoolContext } from "./usePoolContext";

const pool = usePoolContext();
</script>

<template>
  <div class="pool-metrics">
    <MetricCard label="总结池条目" :value="pool.poolStore.total" />
    <MetricCard label="待处理" :value="pool.poolStore.pendingItems.length" />
    <MetricCard label="PDF 任务" :value="pool.pdfDraftStore.activeTaskCount" />
    <MetricCard label="网页任务" :value="pool.webDraftStore.activeTaskCount" />
  </div>
</template>

<style scoped>
.pool-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.pool-metrics :deep(.metric-card) {
  padding: 10px 12px;
  min-height: 50px;

}

.pool-metrics :deep(.metric-card) p {
    margin: 0 7px 0 0;
}

@media (max-width: 900px) {
  .pool-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
