<script setup lang="ts">
import EndpointNotice from "@/components/EndpointNotice.vue";
import { useQaCenterContext } from "./useQaCenterContext";

const qa = useQaCenterContext();
</script>

<template>
  <header class="qa-header">
    <div class="qa-header__title">
      <p class="panel-eyebrow">问答中心</p>
      <h3>围绕知识库连续提问</h3>
    </div>

    <div class="qa-header__meta" aria-label="当前回答状态">
      <span>状态：{{ qa.answerToneLabel }}</span>
      <span>可信度：{{ qa.confidenceLabel }}</span>
      <span>模式：{{ qa.modeLabel }}</span>
    </div>
  </header>

  <EndpointNotice
    v-if="!qa.generationReady"
    type="warning"
    title="问答链路尚未就绪"
    :detail="qa.configStore.generationBlockReason"
  />
</template>

<style scoped>
.qa-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}

.qa-header__title {
  min-width: 0;
}

.qa-header__title h3 {
  margin: 0;
}

.qa-header__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.qa-header__meta span {
  padding: 3px 7px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--panel-strong);
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 960px) {
  .qa-header {
    flex-direction: column;
  }

  .qa-header__meta {
    justify-content: flex-start;
  }
}
</style>
