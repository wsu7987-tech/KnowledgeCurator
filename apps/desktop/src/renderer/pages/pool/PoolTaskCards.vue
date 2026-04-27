<script setup lang="ts">
import { Delete, InfoFilled, Link } from "@element-plus/icons-vue";

import type { UnifiedDraftTaskCard } from "./usePoolPage";
import { usePoolContext } from "./usePoolContext";

const pool = usePoolContext();

const getTaskRowClassName = ({ row }: { row: UnifiedDraftTaskCard }) =>
  row.isActive ? "pool-task-list__row--active" : "";
</script>

<template>
  <section v-if="pool.showDraftTaskList" class="surface-card pool-task-list">
    <div class="pool-task-cards__header">
      <div>
        <p class="panel-eyebrow">Tasks</p>
        <h2>网页任务列表 / PDF 任务列表</h2>
      </div>
      <div class="pool-task-cards__tips">
        <el-popover placement="bottom-end" trigger="click" width="300">
          <template #reference>
            <el-button :icon="InfoFilled" circle plain aria-label="状态说明" />
          </template>
          <div class="pool-task-cards__tip-content">
            <strong>状态说明</strong>
            <p>排队中/处理中表示后台仍在执行；未保存表示已有临时预览；已就绪表示已有可用保存版本；失败需要查看详情或删除后重试。</p>
          </div>
        </el-popover>
        <el-popover placement="bottom-end" trigger="click" width="320">
          <template #reference>
            <el-button :icon="InfoFilled" circle plain aria-label="操作顺序" />
          </template>
          <div class="pool-task-cards__tip-content">
            <strong>操作顺序</strong>
            <p>先查看详情，确认清洗结果；必要时重新解析/抓取；保存当前结果后继续后续处理。</p>
          </div>
        </el-popover>
      </div>
    </div>

    <el-table
      :data="pool.unifiedDraftTaskCards"
      row-key="id"
      class="pool-task-list__table"
      :row-class-name="getTaskRowClassName"
      :max-height="pool.draftTaskTableMaxHeight"
    >
      <el-table-column label="来源" min-width="280">
        <template #default="scope">
          <div v-if="scope?.row" class="pool-task-list__source-cell">
            <div class="pool-task-list__title-line">
              <el-tag size="small" effect="plain">{{ scope.row.sourceLabel }}</el-tag>
              <el-tooltip :content="scope.row.title" placement="top">
                <strong>{{ scope.row.title }}</strong>
              </el-tooltip>
            </div>
            <el-tooltip :content="scope.row.source" placement="top">
              <span>{{ scope.row.source }}</span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="scope">
          <el-tag
            v-if="scope?.row"
            size="small"
            effect="plain"
            :type="pool.mapTaskTagType(scope.row.status)"
          >
            {{ scope.row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="解析器" min-width="150">
        <template #default="scope">
          {{ scope?.row?.parserLabel }}
        </template>
      </el-table-column>
      <el-table-column label="进度" min-width="220">
        <template #default="scope">
          <div v-if="scope?.row" class="pool-task-list__progress-cell">
            <el-progress
              v-if="scope.row.job"
              :percentage="pool.getPdfJobProgress(scope.row.job.processed_pages, scope.row.job.total_pages)"
            />
            <el-tooltip :content="scope.row.progressLabel" placement="top">
              <span>{{ scope.row.progressLabel }}</span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170">
        <template #default="scope">
          {{ scope?.row ? pool.formatDateTime(scope.row.updatedAt) : "" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="scope">
          <div v-if="scope?.row" class="pool-task-list__actions">
            <el-button
              size="small"
              plain
              :icon="Link"
              @click="pool.openDraftTaskDetail(scope.row)"
            >
              查看详情
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              :icon="Delete"
              :aria-label="`删除${scope.row.sourceLabel}任务`"
              @click="pool.removeDraftTask(scope.row)"
            />
          </div>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<style scoped>
.pool-task-list {
  display: grid;
  gap: 12px;
  max-height: 560px;
  overflow: hidden;
}

.pool-task-cards__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.pool-task-cards__header h2 {
  margin: 2px 0 0;
  font-size: 18px;
}

.pool-task-cards__tips {
  display: flex;
  gap: 8px;
}

.pool-task-cards__tip-content {
  display: grid;
  gap: 6px;
  line-height: 1.55;
}

.pool-task-cards__tip-content p {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.pool-task-list__table {
  width: 100%;
}

.pool-task-list__table :deep(.pool-task-list__row--active) {
  --el-table-tr-bg-color: rgba(240, 249, 255, 0.86);
}

.pool-task-list__source-cell,
.pool-task-list__progress-cell {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.pool-task-list__title-line,
.pool-task-list__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pool-task-list__title-line strong,
.pool-task-list__source-cell span,
.pool-task-list__progress-cell span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pool-task-list__source-cell span,
.pool-task-list__progress-cell span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.pool-task-list__actions {
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .pool-task-cards__header {
    display: grid;
    justify-content: stretch;
  }
}
</style>
