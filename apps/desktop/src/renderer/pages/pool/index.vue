<script setup lang="ts">
import { provide } from "vue";

import PdfDraftDrawer from "./PdfDraftDrawer.vue";
import PoolIntakePanel from "./PoolIntakePanel.vue";
import PoolItemsTable from "./PoolItemsTable.vue";
import PoolMetricsBar from "./PoolMetricsBar.vue";
import PoolTaskCards from "./PoolTaskCards.vue";
import WebDraftDrawer from "./WebDraftDrawer.vue";
import { poolPageKey, usePoolPage } from "./usePoolPage";

const pool = usePoolPage();

provide(poolPageKey, pool);
</script>

<template>
  <div class="page-stack pool-page">
    <PoolMetricsBar v-if="!pool.quickCaptureMode" />

    <section
      class="pool-layout"
      :class="{ 'pool-layout--quick-capture': pool.quickCaptureMode }"
    >
      <PoolIntakePanel />
      <PoolTaskCards v-if="!pool.quickCaptureMode" />
      <PoolItemsTable v-if="!pool.quickCaptureMode" />
    </section>

    <WebDraftDrawer v-if="!pool.quickCaptureMode" />
    <PdfDraftDrawer v-if="!pool.quickCaptureMode" />
  </div>
</template>

<style scoped>
.pool-page {
  gap: 12px;
}

.pool-layout {
  display: grid;
  gap: 12px;
}

.pool-layout--quick-capture {
  max-width: 920px;
  margin: 0 auto;
  width: 100%;
}
</style>
