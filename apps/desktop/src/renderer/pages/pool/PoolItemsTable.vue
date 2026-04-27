<script setup lang="ts">
import { Delete, Link, RefreshRight } from "@element-plus/icons-vue";

import EmptyState from "@/components/EmptyState.vue";
import EndpointNotice from "@/components/EndpointNotice.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import type { ApiPoolItem } from "@/types";
import { usePoolContext } from "./usePoolContext";

const pool = usePoolContext();

const statusOptions = [
  { label: "全部状态", value: "all" },
  { label: "待总结", value: "pending" },
  { label: "总结中", value: "running" },
  { label: "已完成", value: "succeeded" },
  { label: "失败", value: "failed" }
];

const itemTitle = (item: ApiPoolItem) => pool.deriveSourceLabel(item);
</script>

<template>
  <section class="surface-card pool-items">
    <div class="pool-items__toolbar">
      <div>
        <p class="panel-eyebrow">Pool Items</p>
        <h2>总结池状态列表</h2>
      </div>
      <div class="pool-items__filters">
        <el-input
          v-model="pool.poolStore.filters.query"
          clearable
          placeholder="搜索来源或标题"
          class="pool-items__search"
        />
        <el-select
          v-model="pool.poolStore.filters.status"
          class="pool-items__status-filter"
        >
          <el-option
            v-for="option in statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-button
          plain
          :icon="RefreshRight"
          :loading="pool.poolStore.loading"
          @click="pool.refreshPoolItems"
        >
          刷新列表
        </el-button>
      </div>
    </div>

    <EndpointNotice
      v-if="pool.poolStore.error"
      type="error"
      title="总结池加载失败"
      :detail="pool.poolStore.error"
    />

    <EndpointNotice
      v-if="pool.showConnectionError"
      type="warning"
      title="后端暂不可用"
      detail="请先确认 FastAPI 服务已经启动。"
    />

    <EmptyState
      v-if="pool.showPoolEmpty"
      title="总结池还没有条目"
      description="先添加网页、PDF、Markdown 或纯文本来源。"
    />
    <EmptyState
      v-else-if="pool.showFilteredEmpty"
      title="没有匹配条目"
      description="调整搜索词或状态筛选后再试。"
    />

    <el-table
      v-else
      v-loading="pool.poolStore.loading"
      :data="pool.pagedPoolItems"
      row-key="id"
      class="pool-items__table"
      :max-height="pool.poolItemsTableMaxHeight"
    >
      <el-table-column label="来源" min-width="260">
        <template #default="{ row }">
          <div class="pool-items__source-cell">
            <el-tooltip :content="itemTitle(row)" placement="top">
              <strong>{{ itemTitle(row) }}</strong>
            </el-tooltip>
            <el-tooltip :content="row.source_value" placement="top">
              <span>{{ row.source_value }}</span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="120">
        <template #default="{ row }">
          {{ pool.mapSourceTypeLabel(row.source_type) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <StatusBadge :status="row.current_status" />
        </template>
      </el-table-column>
      <el-table-column label="清洗" width="110">
        <template #default="{ row }">
          {{ pool.mapCleaningLevelLabel(row.cleaning_level) }}
        </template>
      </el-table-column>
      <el-table-column label="失败原因" min-width="140">
        <template #default="{ row }">
          {{ pool.mapErrorCategoryLabel(row.last_failed_category) }}
        </template>
      </el-table-column>
      <el-table-column prop="display_updated_at" label="更新时间" width="170" />
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <div class="pool-items__actions">
            <el-button
              size="small"
              plain
              :icon="Link"
              :disabled="!row.result_snapshot_id"
              @click="pool.viewItem(row)"
            >
              详情
            </el-button>
            <el-button
              size="small"
              plain
              :disabled="row.current_status === 'running'"
              @click="pool.reingestItem(row.id)"
            >
              重采集
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              :icon="Delete"
              @click="pool.deleteItem(row.id)"
            >
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div
      v-if="!pool.showPoolEmpty && !pool.showFilteredEmpty && pool.visibleItems.length"
      class="pool-items__pagination"
    >
      <el-pagination
        v-model:current-page="pool.poolItemsCurrentPage"
        v-model:page-size="pool.poolItemsPageSize"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        :total="pool.visibleItems.length"
      />
    </div>
  </section>
</template>

<style scoped>
.pool-items {
  display: grid;
  gap: 12px;
  max-height: 620px;
  overflow: hidden;
}

.pool-items__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.pool-items__toolbar h2 {
  margin: 2px 0 0;
  font-size: 18px;
}

.pool-items__filters {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.pool-items__search {
  width: 240px;
}

.pool-items__status-filter {
  width: 130px;
}

.pool-items__table {
  width: 100%;
}

.pool-items__source-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.pool-items__source-cell strong,
.pool-items__source-cell span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pool-items__source-cell span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.pool-items__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pool-items__pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

@media (max-width: 900px) {
  .pool-items__toolbar,
  .pool-items__pagination {
    display: grid;
    justify-content: stretch;
  }

  .pool-items__filters,
  .pool-items__search,
  .pool-items__status-filter {
    width: 100%;
  }
}
</style>
