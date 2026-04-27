<script setup lang="ts">
import { provide } from "vue";

import QaChatPanel from "./QaChatPanel.vue";
import QaEvidenceDrawer from "./QaEvidenceDrawer.vue";
import QaHeaderPanel from "./QaHeaderPanel.vue";
import QaQuestionPanel from "./QaQuestionPanel.vue";
import QaSideColumn from "./QaSideColumn.vue";
import { qaCenterKey, useQaCenter } from "./useQaCenter";

const qa = useQaCenter();

provide(qaCenterKey, qa);
</script>

<template>
  <div class="qa-page">
    <section class="split-layout qa-workbench">
      <article class="page-panel qa-workbench__main">
        <QaHeaderPanel />
        <QaChatPanel />
        <QaQuestionPanel />
      </article>
      <QaSideColumn />
    </section>
    <QaEvidenceDrawer />
  </div>
</template>

<style scoped>
.qa-page {
  min-width: 0;
  min-height: 0;
}

.qa-workbench {
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 14px;
  align-items: stretch;
  height: max(560px, calc(100dvh - 128px));
  min-height: 560px;
  overflow: hidden;
}

.qa-workbench__main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 960px) {
  .qa-workbench {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .qa-workbench__main {
    min-height: 640px;
  }
}
</style>
