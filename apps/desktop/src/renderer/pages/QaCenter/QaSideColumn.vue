<script setup lang="ts">
import QaSideDiagnostics from "./QaSideDiagnostics.vue";
import { useQaCenterContext } from "./useQaCenterContext";

const qa = useQaCenterContext();
</script>

<template>
  <aside class="sticky-column qa-side">
    <el-collapse v-model="qa.sideActivePanels" class="qa-side__collapse">
      <el-collapse-item
        name="filters"
        data-testid="qa-side-card"
        data-card="filters"
      >
        <template #title>
          <div class="qa-side__title">
            <div>
              <p class="panel-eyebrow">筛选条件</p>
              <h3>检索范围</h3>
            </div>
            <el-button
              v-if="qa.hasActiveFilters"
              plain
              size="small"
              @click.stop="qa.clearAllFilters"
            >
              清空
            </el-button>
          </div>
        </template>

        <div class="qa-side__panel">
          <el-form
            :model="qa.filtersForm"
            class="qa-side__filter-form"
            label-position="top"
          >
            <el-form-item label="问答模式">
              <el-select
                v-model="qa.currentMode"
                class="qa-side__mode-select"
                placeholder="选择问答模式…"
              >
                <el-option
                  v-for="option in qa.modeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="来源类型">
              <el-checkbox-group
                v-model="qa.filtersForm.source_types"
                class="qa-side__source-grid"
              >
                <el-checkbox
                  v-for="option in qa.sourceTypeOptions"
                  :key="option.value"
                  class="qa-side__source-chip"
                  :label="option.value"
                >
                  {{ option.label }}
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>

            <div v-if="qa.hasActiveFilters" class="qa-side__active-filters">
              <span>已启用</span>
              <el-tag
                v-for="chip in qa.activeFilterChips"
                :key="`${chip.key}-${chip.value ?? chip.label}`"
                size="small"
                closable
                @close="qa.clearFilterChip(chip.key, chip.value)"
              >
                {{ chip.label }}
              </el-tag>
            </div>

            <div class="qa-side__field-grid">
              <el-form-item label="关键词">
                <el-input
                  v-model="qa.filtersForm.keyword"
                  name="qa-filter-keyword"
                  autocomplete="off"
                  clearable
                  placeholder="例如：向量数据库…"
                />
              </el-form-item>
              <el-form-item label="分类">
                <el-input
                  v-model="qa.filtersForm.category"
                  name="qa-filter-category"
                  autocomplete="off"
                  clearable
                  placeholder="例如：research…"
                />
              </el-form-item>
            </div>

            <el-form-item label="知识条目 ID">
              <el-input
                v-model="qa.filtersForm.knowledge_item_ids"
                name="qa-filter-knowledge-item-ids"
                autocomplete="off"
                type="textarea"
                :rows="2"
                resize="vertical"
                placeholder="多个 ID 用逗号或换行分隔…"
              />
            </el-form-item>

            <div class="qa-side__field-grid">
              <el-form-item label="用户标签">
                <el-input
                  v-model="qa.filtersForm.user_tags"
                  name="qa-filter-user-tags"
                  autocomplete="off"
                  type="textarea"
                  :rows="2"
                  resize="vertical"
                  placeholder="多个标签用逗号或换行分隔…"
                />
              </el-form-item>
              <el-form-item label="AI 标签">
                <el-input
                  v-model="qa.filtersForm.ai_tags"
                  name="qa-filter-ai-tags"
                  autocomplete="off"
                  type="textarea"
                  :rows="2"
                  resize="vertical"
                  placeholder="多个标签用逗号或换行分隔…"
                />
              </el-form-item>
            </div>
          </el-form>
        </div>
      </el-collapse-item>

      <el-collapse-item
        name="suggestions"
        data-testid="qa-side-card"
        data-card="suggestions"
      >
        <template #title>
          <div class="qa-side__title">
            <div>
              <p class="panel-eyebrow">建议问法</p>
              <h3>继续追问</h3>
            </div>
            <span class="qa-side__count">{{ qa.result?.suggested_queries.length ?? 0 }}</span>
          </div>
        </template>

        <div class="qa-side__panel qa-side__suggestions">
          <el-button
            v-for="suggestion in qa.result?.suggested_queries ?? []"
            :key="suggestion"
            class="qa-side__suggestion"
            plain
            :loading="qa.qaStore.loading"
            @click="qa.applySuggestedQuery(suggestion)"
          >
            {{ suggestion }}
          </el-button>
          <p v-if="!(qa.result?.suggested_queries?.length)" class="secondary-text">
            证据不足或问题过宽时，这里会显示推荐问法。
          </p>
        </div>
      </el-collapse-item>

      <el-collapse-item
        name="diagnostics"
        data-testid="qa-side-card"
        data-card="diagnostics"
      >
        <template #title>
          <div class="qa-side__title" data-testid="qa-trace-card-toggle">
            <div>
              <p class="panel-eyebrow">回答诊断</p>
              <h3>状态与 Trace</h3>
            </div>
          </div>
        </template>

        <div class="qa-side__panel">
          <QaSideDiagnostics />
        </div>
      </el-collapse-item>

      <el-collapse-item
        name="sessions"
        data-testid="qa-side-card"
        data-card="sessions"
      >
        <template #title>
          <div class="qa-side__title" data-testid="qa-session-card-toggle">
            <div>
              <p class="panel-eyebrow">问答会话</p>
              <h3>历史上下文</h3>
            </div>
            <span class="qa-side__count">{{ qa.sessions.length }}</span>
          </div>
        </template>

        <div class="qa-side__panel qa-side__sessions" data-testid="qa-session-card-body">
          <button
            v-for="session in qa.sessions"
            :key="session.session_id"
            type="button"
            class="qa-side__session-item"
            :class="{
              'qa-side__session-item--active':
                session.session_id === qa.qaStore.selectedSessionId
            }"
            :aria-current="
              session.session_id === qa.qaStore.selectedSessionId ? 'true' : undefined
            "
            data-testid="qa-session-item"
            @click="qa.openSession(session.session_id)"
          >
            <strong>{{ session.title }}</strong>
            <span class="secondary-text">{{ session.message_count }} 条消息</span>
            <span class="secondary-text">{{ qa.formatDateTime(session.updated_at) }}</span>
          </button>
          <p v-if="!qa.sessions.length" class="secondary-text">
            还没有持久化问答会话。
          </p>
        </div>
      </el-collapse-item>
    </el-collapse>
  </aside>
</template>

<style scoped>
.qa-side {
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 2px;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.qa-side__collapse {
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  border: 0;
}

.qa-side__collapse :deep(.el-collapse-item) {
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
  box-shadow: var(--shadow-subtle);
}

.qa-side__collapse :deep(.el-collapse-item__header) {
  min-width: 0;
  max-width: 100%;
  height: auto;
  padding: 10px 12px;
  border-bottom: 0;
  background: var(--panel);
  line-height: 1.3;
}

.qa-side__collapse :deep(.el-collapse-item__wrap) {
  max-width: 100%;
  overflow: visible;
  border-bottom: 0;
  background: transparent;
}

.qa-side__collapse :deep(.el-collapse-item__content) {
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  padding: 0 12px 12px;
}

.qa-side__title {
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.qa-side__title h3 {
  margin: 0;
  font-size: 14px;
}

.qa-side__count {
  flex: 0 0 auto;
  min-width: 24px;
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--ink-soft);
  background: var(--panel-strong);
  font-size: 12px;
  text-align: center;
}

.qa-side__panel,
.qa-side__filter-form,
.qa-side__suggestions,
.qa-side__sessions {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.qa-side__filter-form :deep(.el-form-item) {
  min-width: 0;
  margin-bottom: 0;
}

.qa-side__filter-form :deep(.el-form-item__label) {
  margin-bottom: 4px;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.35;
}

.qa-side__mode-select {
  width: 100%;
}

.qa-side__source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
}

.qa-side__source-chip {
  min-width: 0;
  margin: 0;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--panel-strong);
}

.qa-side__source-chip :deep(.el-checkbox__label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qa-side__active-filters {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  gap: 6px;
  align-items: center;
  overflow-x: hidden;
}

.qa-side__active-filters > span {
  color: var(--ink-soft);
  font-size: 12px;
}

.qa-side__field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.qa-side__suggestion {
  width: 100%;
  min-width: 0;
  min-height: 0;
  justify-content: flex-start;
  white-space: normal;
  text-align: left;
}

.qa-side__suggestion :deep(span) {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 1.45;
}

.qa-side__session-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  padding: 10px;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
  content-visibility: auto;
  contain-intrinsic-size: 78px;
}

.qa-side__session-item strong,
.qa-side__session-item span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qa-side__session-item--active {
  border-color: rgba(29, 107, 82, 0.32);
  background: #eef6f0;
  box-shadow: inset 3px 0 0 var(--accent);
}

@media (max-width: 960px) {
  .qa-side {
    height: auto;
    max-height: none;
    overflow: visible;
    scrollbar-gutter: auto;
  }
}
</style>
