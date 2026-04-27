<script setup lang="ts">
import { useQaCenterContext } from "./useQaCenterContext";

const qa = useQaCenterContext();
</script>

<template>
  <div class="qa-side-diagnostics" data-testid="qa-trace-card-body">
    <div class="qa-side-diagnostics__metrics">
      <div>
        <span>当前状态</span>
        <strong>{{ qa.answerToneLabel }}</strong>
      </div>
      <div>
        <span>可信度</span>
        <strong>{{ qa.confidenceLabel }}</strong>
      </div>
      <div>
        <span>原文证据</span>
        <strong>{{ qa.result?.citations.length ?? 0 }}</strong>
      </div>
      <div>
        <span>辅助摘要</span>
        <strong>{{ qa.result?.used_grounded_items.length ?? 0 }}</strong>
      </div>
    </div>

    <template v-if="qa.traceSnapshot">
      <div class="qa-side-diagnostics__trace-grid">
        <div>
          <span>Rewrite strategy</span>
          <strong>{{ qa.traceSnapshot.strategy }}</strong>
        </div>
        <div>
          <span>Intent</span>
          <strong>{{ qa.traceSnapshot.intent }}</strong>
        </div>
        <div>
          <span>Used history</span>
          <strong>{{ qa.traceSnapshot.usedHistory ? "yes" : "no" }}</strong>
        </div>
        <div>
          <span>Verification</span>
          <strong>{{ qa.traceSnapshot.verificationStatus }}</strong>
        </div>
        <div>
          <span>Retry count</span>
          <strong>{{ qa.traceSnapshot.retryCount }}</strong>
        </div>
        <div>
          <span>Citations</span>
          <strong>{{ qa.traceSnapshot.citationIds.length }}</strong>
        </div>
      </div>
      <p class="secondary-text">Original: {{ qa.traceSnapshot.question }}</p>
      <p class="secondary-text">Retrieval: {{ qa.traceSnapshot.rewrittenQuestion }}</p>
      <p class="secondary-text">Verifier: {{ qa.traceSnapshot.verificationReason }}</p>
      <div class="qa-side-diagnostics__trace-tags">
        <el-tag
          v-for="flag in qa.traceSnapshot.riskFlags"
          :key="flag"
          size="small"
        >
          {{ flag }}
        </el-tag>
      </div>
      <p class="secondary-text">
        Citation IDs: {{ qa.traceSnapshot.citationIds.join(", ") || "none" }}
      </p>
    </template>
    <p v-else class="secondary-text">No QA trace yet.</p>
  </div>
</template>

<style scoped>
.qa-side-diagnostics,
.qa-side-diagnostics__trace-tags {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.qa-side-diagnostics__metrics,
.qa-side-diagnostics__trace-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.qa-side-diagnostics__metrics div,
.qa-side-diagnostics__trace-grid div {
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--panel-strong);
}

.qa-side-diagnostics__metrics span,
.qa-side-diagnostics__trace-grid span {
  display: block;
  color: var(--ink-soft);
  font-size: 11px;
}

.qa-side-diagnostics__metrics strong,
.qa-side-diagnostics__trace-grid strong {
  display: block;
  margin-top: 3px;
  overflow-wrap: anywhere;
  font-size: 13px;
}

.qa-side-diagnostics p {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.qa-side-diagnostics__trace-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  overflow-x: hidden;
}
</style>
