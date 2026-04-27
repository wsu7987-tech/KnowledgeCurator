<script setup lang="ts">
import EndpointNotice from "@/components/EndpointNotice.vue";
import PoolMetadataFields from "@/components/PoolMetadataFields.vue";
import { usePoolContext } from "./usePoolContext";

const pool = usePoolContext();
</script>

<template>
  <el-drawer
    v-model="pool.webDraftStore.drawerOpen"
    title="网页抓取预览"
    size="48%"
    destroy-on-close
    :before-close="pool.handleWebDraftBeforeClose"
  >
    <div v-if="pool.webDraftStore.draft" class="draft-drawer">
      <EndpointNotice
        v-if="pool.webDraftStore.error"
        type="error"
        title="网页草稿操作失败"
        :detail="pool.webDraftStore.error"
      />
      <EndpointNotice
        :type="pool.webDraftStore.hasUnsavedPreview ? 'warning' : 'success'"
        :title="pool.webDraftPreviewHeading"
        :detail="pool.webDraftPreviewNotice"
      />

      <div class="draft-drawer__toolbar">
        <el-button :loading="pool.webDraftStore.reparsing" @click="pool.reparseWebDraft">
          重新抓取
        </el-button>
        <el-button
          v-if="
            pool.webDraftStore.activeJob &&
            ['queued', 'running'].includes(pool.webDraftStore.activeJob.status)
          "
          plain
          @click="pool.webDraftStore.cancelReparse"
        >
          取消抓取
        </el-button>
        <el-button
          type="primary"
          plain
          :disabled="!pool.webDraftStore.hasUnsavedPreview"
          :loading="pool.webDraftStore.saving"
          @click="pool.saveCurrentWebResult"
        >
          保存当前结果
        </el-button>
        <el-button
          plain
          :disabled="!pool.webDraftStore.activePreviewResult"
          @click="pool.saveWebResultToLocal"
        >
          保存抓取结果到本地
        </el-button>
      </div>

      <div class="draft-drawer__meta">
        <div>
          <span>网页</span>
          <strong>{{ pool.webDraftStore.draft.title || pool.webDraftStore.draft.source_name }}</strong>
        </div>
        <div>
          <span>当前方案</span>
          <strong>
            {{
              pool.webDraftStore.activePreviewResult
                ? pool.mapWebParserLabel(pool.webDraftStore.activePreviewResult.parser_name)
                : "暂无"
            }}
          </strong>
        </div>
        <div>
          <span>段落</span>
          <strong>{{ pool.webDraftStore.activePreviewResult?.section_count ?? 0 }}</strong>
        </div>
        <div>
          <span>字符数</span>
          <strong>{{ pool.webDraftStore.activePreviewResult?.char_count ?? 0 }}</strong>
        </div>
        <div>
          <span>生效版本</span>
          <strong>{{ pool.savedWebVersionNote }}</strong>
        </div>
      </div>

      <article v-if="pool.webDraftStore.activeJob" class="surface-card draft-drawer__card">
        <p class="panel-eyebrow">后台任务</p>
        <div class="draft-drawer__status">
          <strong>{{ pool.mapWebTaskStatusLabel(pool.webDraftStore.activeJob.status) }}</strong>
          <span>
            {{ pool.webDraftStore.activeJob.processed_pages }}/{{
              pool.webDraftStore.activeJob.total_pages || "?"
            }}
            段
          </span>
        </div>
        <el-progress
          :percentage="
            pool.getPdfJobProgress(
              pool.webDraftStore.activeJob.processed_pages,
              pool.webDraftStore.activeJob.total_pages
            )
          "
        />
      </article>

      <article class="surface-card draft-drawer__card">
        <div class="draft-drawer__preview-header">
          <p class="panel-eyebrow">{{ pool.webDraftPreviewHeading }}</p>
          <el-segmented
            v-model="pool.previewViewMode"
            :options="[
              { label: '预览', value: 'preview' },
              { label: '显示全文', value: 'full' }
            ]"
          />
        </div>
        <div class="draft-drawer__cleaning-actions">
          <el-button
            size="small"
            plain
            :type="pool.webPreviewCleaningMode === 'enhanced' ? 'primary' : undefined"
            :disabled="pool.webPreviewCleaningMode === 'enhanced'"
            @click="pool.webPreviewCleaningMode = 'enhanced'"
          >
            增强清洗
          </el-button>
          <el-button
            size="small"
            plain
            :disabled="pool.webPreviewCleaningMode === 'basic'"
            @click="pool.webPreviewCleaningMode = 'basic'"
          >
            还原
          </el-button>
        </div>
        <div class="draft-drawer__note">
          <strong>{{ pool.webCleaningStatus.label }}</strong>
          <span>{{ pool.webCleaningStatus.detail }}</span>
        </div>
        <div
          v-if="pool.webPreviewContent.mode === 'markdown'"
          class="draft-drawer__markdown markdown-body"
          v-html="pool.renderedWebPreviewHtml"
        />
        <pre v-else class="draft-drawer__text">{{ pool.webPreviewContent.content }}</pre>
      </article>

      <article class="surface-card draft-drawer__card">
        <p class="panel-eyebrow">分类与标签</p>
        <PoolMetadataFields
          test-id-prefix="web-draft"
          :category="pool.activeWebDraftMetadata.category"
          :tags="pool.activeWebDraftMetadata.tags"
          :suggest-loading="pool.suggestingWebMetadata"
          @update:category="
            pool.activeWebDraftMetadata = {
              ...pool.activeWebDraftMetadata,
              category: $event
            }
          "
          @update:tags="
            pool.activeWebDraftMetadata = {
              ...pool.activeWebDraftMetadata,
              tags: $event
            }
          "
          @suggest="pool.suggestWebDraftMetadata"
        />
      </article>

      <article class="surface-card draft-drawer__card">
        <p class="panel-eyebrow">抓取版本</p>
        <div class="draft-drawer__versions">
          <button
            v-for="version in [...pool.webDraftStore.draft.parse_results].sort(
              (a, b) => b.created_at.localeCompare(a.created_at)
            )"
            :key="version.id"
            type="button"
            class="draft-drawer__version"
            :class="{
              'draft-drawer__version--active':
                version.id === pool.webDraftStore.activePreviewResult?.id
            }"
            @click="pool.webDraftStore.selectPreviewResult(version.id)"
          >
            <strong>{{ pool.mapWebParserLabel(version.parser_name) }}</strong>
            <span>{{ pool.formatDateTime(version.created_at) }}</span>
            <el-tag size="small" effect="plain">
              {{
                version.id === pool.webDraftStore.draft.saved_parse_result_id
                  ? "已保存"
                  : pool.mapWebTaskStatusLabel(version.status)
              }}
            </el-tag>
          </button>
        </div>
      </article>
    </div>

    <template #footer>
      <div class="draft-drawer__footer">
        <el-button @click="pool.closeWebDraftDrawer">关闭</el-button>
        <el-button
          type="primary"
          :disabled="!pool.webDraftStore.savedParseResult"
          :loading="pool.webDraftStore.committing"
          @click="pool.commitWebDraft"
        >
          加入总结池
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.draft-drawer,
.draft-drawer__card,
.draft-drawer__versions {
  display: grid;
  gap: 12px;
}

.draft-drawer__toolbar,
.draft-drawer__preview-header,
.draft-drawer__cleaning-actions,
.draft-drawer__status,
.draft-drawer__footer {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.draft-drawer__preview-header,
.draft-drawer__status,
.draft-drawer__footer {
  justify-content: space-between;
}

.draft-drawer__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.draft-drawer__meta div,
.draft-drawer__note {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.04);
  min-width: 0;
}

.draft-drawer__meta span,
.draft-drawer__note span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.draft-drawer__text,
.draft-drawer__markdown {
  max-height: 420px;
  overflow: auto;
}

.draft-drawer__text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
}

.draft-drawer__version {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.draft-drawer__version--active {
  border-color: rgba(14, 165, 233, 0.42);
  background: rgba(240, 249, 255, 0.92);
}
</style>
