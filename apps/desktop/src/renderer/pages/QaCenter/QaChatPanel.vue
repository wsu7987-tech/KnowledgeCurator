<script setup lang="ts">
import EmptyState from "@/components/EmptyState.vue";
import EndpointNotice from "@/components/EndpointNotice.vue";
import { useQaCenterContext } from "./useQaCenterContext";

const qa = useQaCenterContext();
</script>

<template>
  <section class="qa-chat-panel">
    <EndpointNotice
      v-if="qa.qaStore.connectionUnavailable"
      type="error"
      title="无法连接后端"
      detail="问答依赖本地后端服务，请先启动后端后再重试。"
    />

    <EndpointNotice
      v-else-if="qa.qaStore.endpointUnavailable"
      type="warning"
      title="问答接口不可用"
      detail="后端可以访问，但当前构建还没有暴露问答接口。"
    />

    <EmptyState
      v-else-if="qa.qaStore.loading && qa.chatMessages.length === 0"
      title="正在生成回答"
      description="正在检索证据并组织 grounded answer。"
    />

    <EmptyState
      v-else-if="qa.chatMessages.length === 0"
      title="还没有对话"
      description="输入问题后，系统会以多轮对话形式展示回答、证据和后续建议。"
    />

    <div
      v-else
      class="qa-chat"
      data-testid="qa-chat-thread"
      aria-live="polite"
      aria-atomic="false"
    >
      <article
        v-for="message in qa.chatMessages"
        :key="message.message_id"
        class="qa-chat__row"
        :class="`qa-chat__row--${message.role}`"
      >
        <div class="qa-chat__avatar">
          {{ message.role === "user" ? "我" : "AI" }}
        </div>
        <div class="qa-chat__bubble">
          <div class="qa-chat__meta">
            <strong>{{ message.role === "user" ? "你" : "知识库助手" }}</strong>
            <span v-if="message.created_at" class="secondary-text">
              {{ qa.formatDateTime(message.created_at) }}
            </span>
            <span v-if="message.answer_status" class="secondary-text">
              {{ message.answer_status }}
            </span>
          </div>
          <p>{{ message.content }}</p>
          <p v-if="message.rewritten_question" class="secondary-text">
            检索问题：{{ message.rewritten_question }}
          </p>
          <div
            v-if="message.role === 'assistant' && qa.hasMessageEvidence(message)"
            class="qa-chat__evidence-line"
          >
            <span>证据</span>
            <button
              v-if="message.citations?.length"
              type="button"
              data-testid="qa-citations-link"
              @click="qa.openEvidenceDrawer(message, 'citations')"
            >
              原文证据 {{ message.citations.length }} 条
            </button>
            <button
              v-if="message.used_grounded_items?.length"
              type="button"
              data-testid="qa-grounded-link"
              @click="qa.openEvidenceDrawer(message, 'grounded')"
            >
              辅助摘要 {{ message.used_grounded_items.length }} 条
            </button>
            <span v-if="message.answer_status">
              {{ qa.answerStatusLabel(message.answer_status) }}
            </span>
            <span v-if="typeof message.confidence === 'number'">
              可信度 {{ qa.formatConfidence(message.confidence) }}
            </span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.qa-chat-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.qa-chat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  overflow: auto;
  overscroll-behavior: contain;
  background:
    linear-gradient(90deg, rgba(23, 35, 29, 0.028) 1px, transparent 1px),
    #fbfcf9;
  background-size: 20px 20px;
}

.qa-chat__row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.qa-chat__row--user {
  grid-template-columns: minmax(0, 1fr) 30px;
}

.qa-chat__row--user .qa-chat__avatar {
  grid-column: 2;
  background: var(--accent);
  color: #ffffff;
}

.qa-chat__row--user .qa-chat__bubble {
  grid-column: 1;
  grid-row: 1;
  justify-self: end;
  border-color: rgba(29, 107, 82, 0.18);
  background: #eef6f0;
}

.qa-chat__avatar {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 7px;
  background: #e8ede7;
  color: #26322c;
  font-size: 11px;
  font-weight: 700;
}

.qa-chat__bubble {
  width: fit-content;
  max-width: min(72ch, 100%);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  padding: 11px 13px;
  background: #ffffff;
  box-shadow: var(--shadow-subtle);
  line-height: 1.72;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.qa-chat__bubble p {
  margin: 0;
}

.qa-chat__bubble p + p {
  margin-top: 8px;
}

.qa-chat__meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 7px;
  font-size: 12px;
}

.qa-chat__evidence-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(65, 81, 71, 0.12);
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.5;
}

.qa-chat__evidence-line button {
  padding: 0;
  border: 0;
  color: var(--accent);
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.qa-chat__evidence-line button:hover,
.qa-chat__evidence-line button:focus-visible {
  color: #15543e;
}
</style>
