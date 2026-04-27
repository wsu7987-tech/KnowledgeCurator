<script setup lang="ts">
import EmptyState from "@/components/EmptyState.vue";
import { useQaCenterContext } from "./useQaCenterContext";

const qa = useQaCenterContext();
</script>

<template>
  <el-drawer
    v-model="qa.evidenceDrawerOpen"
    class="qa-evidence-drawer"
    direction="rtl"
    size="44%"
    :title="qa.evidenceDrawerTitle"
    destroy-on-close
  >
    <div class="qa-evidence-drawer__body" data-testid="qa-evidence-drawer">
      <div class="qa-evidence-drawer__toolbar">
        <el-segmented
          v-model="qa.evidenceDrawerKind"
          :options="qa.evidenceKindOptions"
        />
        <p v-if="qa.selectedEvidenceMessage" class="secondary-text">
          来自回答：{{ qa.selectedEvidenceMessage.content.slice(0, 80) }}
        </p>
      </div>

      <EmptyState
        v-if="!qa.selectedEvidenceMessage"
        title="没有可展示的证据"
        description="请选择一条带证据的回答后再查看。"
      />

      <section
        v-else-if="qa.evidenceDrawerKind === 'citations'"
        class="qa-evidence-drawer__list"
        aria-label="原文证据列表"
      >
        <EmptyState
          v-if="qa.selectedCitations.length === 0"
          title="没有原文证据"
          description="这条回答没有返回 citation。"
        />
        <template v-else>
          <article
            v-for="citation in qa.selectedCitations"
            :key="citation.citation_id"
            class="qa-evidence-drawer__item"
          >
            <div class="qa-evidence-drawer__item-head">
              <div>
                <h3>{{ citation.title || citation.source_name }}</h3>
                <p class="secondary-text">
                  {{ citation.citation_id }}
                  <span v-if="citation.section_title">
                    · {{ citation.section_title }}
                  </span>
                </p>
              </div>
              <el-tag size="small">
                {{ qa.mapSourceTypeLabel(citation.source_type) }}
              </el-tag>
            </div>
            <p class="qa-evidence-drawer__snippet">{{ citation.snippet }}</p>
            <p
              v-if="citation.expanded_context_snippet"
              class="secondary-text qa-evidence-drawer__context"
            >
              {{ citation.expanded_context_snippet }}
            </p>
            <dl class="qa-evidence-drawer__meta">
              <div>
                <dt>来源</dt>
                <dd>{{ citation.source_name || citation.source_value }}</dd>
              </div>
              <div>
                <dt>知识条目</dt>
                <dd>{{ citation.knowledge_item_id }}</dd>
              </div>
              <div v-if="citation.created_at">
                <dt>创建时间</dt>
                <dd>{{ qa.formatDateTime(citation.created_at) }}</dd>
              </div>
            </dl>
          </article>
        </template>
      </section>

      <section
        v-else
        class="qa-evidence-drawer__list"
        aria-label="辅助摘要证据列表"
      >
        <EmptyState
          v-if="qa.selectedGroundedItems.length === 0"
          title="没有辅助摘要证据"
          description="这条回答没有命中 grounded item。"
        />
        <template v-else>
          <article
            v-for="item in qa.selectedGroundedItems"
            :key="`${item.snapshot_id}-${item.claim}`"
            class="qa-evidence-drawer__item"
          >
            <div class="qa-evidence-drawer__item-head">
              <div>
                <h3>{{ item.title }}</h3>
                <p class="secondary-text">{{ item.final_category || "未分类" }}</p>
              </div>
              <el-tag size="small">摘要</el-tag>
            </div>
            <p class="qa-evidence-drawer__snippet">{{ item.claim }}</p>
            <p class="secondary-text qa-evidence-drawer__context">
              {{ item.evidence_titles.join(" · ") || "无关联标题" }}
            </p>
            <dl class="qa-evidence-drawer__meta">
              <div>
                <dt>Snapshot</dt>
                <dd>{{ item.snapshot_id }}</dd>
              </div>
              <div>
                <dt>Citations</dt>
                <dd>{{ item.citation_ids.join(", ") || "无" }}</dd>
              </div>
            </dl>
          </article>
        </template>
      </section>
    </div>
  </el-drawer>
</template>

<style scoped>
.qa-evidence-drawer__body {
  display: grid;
  gap: 14px;
}

.qa-evidence-drawer__toolbar {
  display: grid;
  gap: 8px;
}

.qa-evidence-drawer__toolbar :deep(.el-segmented) {
  width: 100%;
}

.qa-evidence-drawer__toolbar :deep(.el-segmented__group) {
  width: 100%;
}

.qa-evidence-drawer__list {
  display: grid;
  gap: 10px;
}

.qa-evidence-drawer__item {
  display: grid;
  gap: 9px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
  content-visibility: auto;
  contain-intrinsic-size: 180px;
}

.qa-evidence-drawer__item-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
}

.qa-evidence-drawer__item h3,
.qa-evidence-drawer__item p {
  margin: 0;
}

.qa-evidence-drawer__snippet {
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.qa-evidence-drawer__context {
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.qa-evidence-drawer__meta {
  display: grid;
  gap: 6px;
  margin: 0;
  color: var(--ink-soft);
  font-size: 12px;
}

.qa-evidence-drawer__meta div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
}

.qa-evidence-drawer__meta dt,
.qa-evidence-drawer__meta dd {
  min-width: 0;
  margin: 0;
}

.qa-evidence-drawer__meta dd {
  overflow-wrap: anywhere;
}

@media (max-width: 960px) {
  .qa-evidence-drawer :deep(.el-drawer) {
    width: min(100vw, 520px) !important;
  }
}
</style>
