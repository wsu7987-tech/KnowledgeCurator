<script setup lang="ts">
import EndpointNotice from "@/components/EndpointNotice.vue";
import PoolMetadataFields from "@/components/PoolMetadataFields.vue";
import { usePoolContext } from "./usePoolContext";

const pool = usePoolContext();
</script>

<template>
  <el-drawer
    v-model="pool.pdfDraftStore.drawerOpen"
    title="PDF 解析预览"
    size="48%"
    destroy-on-close
    :before-close="pool.handlePdfDraftBeforeClose"
  >
    <div v-if="pool.pdfDraftStore.draft" class="draft-drawer">
      <EndpointNotice
        v-if="pool.pdfDraftStore.error"
        type="error"
        title="PDF 草稿操作失败"
        :detail="pool.pdfDraftStore.error"
      />
      <EndpointNotice
        :type="pool.pdfDraftStore.hasUnsavedPreview ? 'warning' : 'success'"
        :title="pool.draftPreviewHeading"
        :detail="pool.draftPreviewNotice"
      />

      <div class="draft-drawer__toolbar">
        <el-select v-model="pool.pdfDraftStore.selectedParser" class="draft-drawer__parser">
          <el-option
            v-for="option in pool.parserOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-button :loading="pool.pdfDraftStore.reparsing" @click="pool.reparsePdfDraft">
          重新解析
        </el-button>
        <el-button
          v-if="
            pool.pdfDraftStore.activeJob &&
            ['queued', 'running'].includes(pool.pdfDraftStore.activeJob.status)
          "
          plain
          @click="pool.pdfDraftStore.cancelReparse"
        >
          取消解析
        </el-button>
        <el-button
          type="primary"
          plain
          :disabled="!pool.pdfDraftStore.hasUnsavedPreview"
          :loading="pool.pdfDraftStore.saving"
          @click="pool.saveCurrentPdfResult"
        >
          保存当前结果
        </el-button>
        <el-button
          plain
          :disabled="!pool.pdfDraftStore.activePreviewResult"
          @click="pool.savePdfResultToLocal"
        >
          保存解析结果到本地
        </el-button>
      </div>

      <div class="draft-drawer__meta">
        <div>
          <span>文件</span>
          <strong>{{ pool.pdfDraftStore.draft.source_name }}</strong>
        </div>
        <div>
          <span>当前方案</span>
          <strong>
            {{
              pool.pdfDraftStore.activePreviewResult
                ? pool.mapPdfParserLabel(pool.pdfDraftStore.activePreviewResult.parser_name)
                : "暂无"
            }}
          </strong>
        </div>
        <div>
          <span>页数</span>
          <strong>{{ pool.pdfDraftStore.activePreviewResult?.page_count ?? 0 }}</strong>
        </div>
        <div>
          <span>字符数</span>
          <strong>{{ pool.pdfDraftStore.activePreviewResult?.char_count ?? 0 }}</strong>
        </div>
        <div>
          <span>生效版本</span>
          <strong>{{ pool.savedVersionNote }}</strong>
        </div>
      </div>

      <article v-if="pool.pdfDraftStore.activeJob" class="surface-card draft-drawer__card">
        <p class="panel-eyebrow">后台任务</p>
        <div class="draft-drawer__status">
          <strong>{{ pool.mapPdfTaskStatusLabel(pool.pdfDraftStore.activeJob.status) }}</strong>
          <span>
            {{
              pool.formatPdfJobProgress(
                pool.pdfDraftStore.activeJob.processed_pages,
                pool.pdfDraftStore.activeJob.total_pages
              )
            }}
          </span>
        </div>
        <el-progress
          :percentage="
            pool.getPdfJobProgress(
              pool.pdfDraftStore.activeJob.processed_pages,
              pool.pdfDraftStore.activeJob.total_pages
            )
          "
        />
      </article>

      <article class="surface-card draft-drawer__card">
        <div class="draft-drawer__preview-header">
          <p class="panel-eyebrow">{{ pool.draftPreviewHeading }}</p>
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
            :type="pool.pdfPreviewCleaningMode === 'enhanced' ? 'primary' : undefined"
            :disabled="pool.pdfPreviewCleaningMode === 'enhanced'"
            @click="pool.pdfPreviewCleaningMode = 'enhanced'"
          >
            增强清洗
          </el-button>
          <el-button
            size="small"
            plain
            :disabled="pool.pdfPreviewCleaningMode === 'basic'"
            @click="pool.pdfPreviewCleaningMode = 'basic'"
          >
            还原
          </el-button>
        </div>
        <div class="draft-drawer__note">
          <strong>{{ pool.pdfCleaningStatus.label }}</strong>
          <span>{{ pool.pdfCleaningStatus.detail }}</span>
        </div>
        <div
          v-if="pool.previewContent.mode === 'markdown'"
          class="draft-drawer__markdown markdown-body"
          v-html="pool.renderedPreviewHtml"
        />
        <pre v-else class="draft-drawer__text">{{ pool.previewContent.content }}</pre>
      </article>

      <article class="surface-card draft-drawer__card">
        <p class="panel-eyebrow">分类与标签</p>
        <PoolMetadataFields
          test-id-prefix="pdf-draft"
          :category="pool.activePdfDraftMetadata.category"
          :tags="pool.activePdfDraftMetadata.tags"
          :suggest-loading="pool.suggestingPdfMetadata"
          @update:category="
            pool.activePdfDraftMetadata = {
              ...pool.activePdfDraftMetadata,
              category: $event
            }
          "
          @update:tags="
            pool.activePdfDraftMetadata = {
              ...pool.activePdfDraftMetadata,
              tags: $event
            }
          "
          @suggest="pool.suggestPdfDraftMetadata"
        />
      </article>

      <article class="surface-card draft-drawer__card">
        <p class="panel-eyebrow">解析版本</p>
        <div class="draft-drawer__versions">
          <button
            v-for="version in [...pool.pdfDraftStore.draft.parse_results].sort(
              (a, b) => b.created_at.localeCompare(a.created_at)
            )"
            :key="version.id"
            type="button"
            class="draft-drawer__version"
            :class="{
              'draft-drawer__version--active':
                version.id === pool.pdfDraftStore.activePreviewResult?.id
            }"
            @click="pool.pdfDraftStore.selectPreviewResult(version.id)"
          >
            <strong>{{ pool.mapPdfParserLabel(version.parser_name) }}</strong>
            <span>{{ pool.formatDateTime(version.created_at) }}</span>
            <el-tag size="small" effect="plain">
              {{
                version.id === pool.pdfDraftStore.draft.saved_parse_result_id
                  ? "已保存"
                  : pool.mapPdfTaskStatusLabel(version.status)
              }}
            </el-tag>
          </button>
        </div>
      </article>
    </div>

    <template #footer>
      <div class="draft-drawer__footer">
        <el-button @click="pool.closePdfDraftDrawer">关闭</el-button>
        <el-button
          type="primary"
          :disabled="!pool.pdfDraftStore.savedParseResult"
          :loading="pool.pdfDraftStore.committing"
          @click="pool.commitPdfDraft"
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

.draft-drawer__parser {
  width: 220px;
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
