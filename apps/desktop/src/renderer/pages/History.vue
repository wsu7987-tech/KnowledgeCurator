<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import EmptyState from "@/components/EmptyState.vue";
import EndpointNotice from "@/components/EndpointNotice.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { formatDateTime } from "@/services/format";
import { mapRunStageLabel, mapRunTaskTypeLabel } from "@/services/contract";
import { useRunsStore } from "@/stores/runs";

const router = useRouter();
const route = useRoute();
const runsStore = useRunsStore();
const filters = reactive({
  taskType: "",
  status: ""
});
const currentPage = ref(1);
const pageSize = ref(10);
const validTaskTypes = new Set(["", "summary", "report"]);
const validRunStatuses = new Set(["", "running", "completed", "failed", "cancelled"]);

const canShowTable = computed(
  () =>
    !runsStore.loadingList && !runsStore.listConnectionUnavailable && !runsStore.historyUnavailable
);

const reload = async (resetPage = true) => {
  if (resetPage) {
    currentPage.value = 1;
  }
  await runsStore.loadRunsList(filters.taskType || undefined, filters.status || undefined);
};

const pagedRuns = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return runsStore.list.slice(start, start + pageSize.value);
});

const openReport = (weekKey?: string | null) => {
  router.push({
    name: "reports",
    query: weekKey ? { weekKey } : undefined
  });
};

watch(
  () => [filters.taskType, filters.status, currentPage.value, pageSize.value] as const,
  ([taskType, status, page, size]) => {
    void router.replace({
      query: {
        ...route.query,
        taskType: taskType || undefined,
        status: status || undefined,
        page: page > 1 ? String(page) : undefined,
        pageSize: size !== 10 ? String(size) : undefined
      }
    });
  }
);

onMounted(() => {
  const queryTaskType = typeof route.query.taskType === "string" ? route.query.taskType : "";
  const queryStatus = typeof route.query.status === "string" ? route.query.status : "";
  const queryPage = typeof route.query.page === "string" ? Number(route.query.page) : 1;
  const queryPageSize = typeof route.query.pageSize === "string" ? Number(route.query.pageSize) : 10;
  filters.taskType = validTaskTypes.has(queryTaskType) ? queryTaskType : "";
  filters.status = validRunStatuses.has(queryStatus) ? queryStatus : "";
  currentPage.value = Number.isFinite(queryPage) && queryPage > 0 ? queryPage : 1;
  pageSize.value = Number.isFinite(queryPageSize) && queryPageSize > 0 ? queryPageSize : 10;
  void reload(false);
});
</script>

<template>
  <div class="page-stack history-page">
    <section class="page-panel history-toolbar-panel">
      <div class="toolbar history-toolbar">
        <div class="toolbar__group">
          <el-select
            v-model="filters.taskType"
            aria-label="筛选任务类型"
            placeholder="任务类型"
            clearable
            style="width: 160px"
          >
            <el-option label="总结" value="summary" />
            <el-option label="周报" value="report" />
          </el-select>
          <el-select
            v-model="filters.status"
            aria-label="筛选运行状态"
            placeholder="运行状态"
            clearable
            style="width: 160px"
          >
            <el-option label="进行中" value="running" />
            <el-option label="已完成" value="completed" />
            <el-option label="失败" value="failed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </div>
        <el-button type="primary" plain @click="reload()">刷新列表</el-button>
      </div>
    </section>

    <el-skeleton v-if="runsStore.loadingList && !runsStore.hasLoadedList" animated :rows="6" />

    <EndpointNotice
      v-else-if="runsStore.listConnectionUnavailable"
      type="error"
      title="无法读取运行历史"
      :detail="runsStore.listError ?? '当前无法连接后端。'"
    />

    <EndpointNotice
      v-else-if="runsStore.historyUnavailable"
      title="运行历史接口不可用"
      :detail="runsStore.listError ?? '当前后端构建没有暴露 /api/runs。'"
    />

    <section v-else-if="canShowTable && runsStore.list.length" class="table-panel history-table-panel">
      <el-table :data="pagedRuns" stripe>
        <el-table-column prop="run_id" label="run_id" min-width="240" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            {{ mapRunTaskTypeLabel(row.task_type) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <StatusBadge :status="row.status" run />
          </template>
        </el-table-column>
        <el-table-column label="阶段" min-width="160">
          <template #default="{ row }">
            {{ mapRunStageLabel(row.stage) }}
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.updated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="260" fixed="right">
          <template #default="{ row }">
            <div class="toolbar__group">
              <RouterLink
                v-slot="{ href, navigate }"
                custom
                :to="{ name: 'run-detail', params: { runId: row.run_id } }"
              >
                <el-button tag="a" :href="href" link type="primary" @click="navigate">
                  查看详情
                </el-button>
              </RouterLink>
              <el-button v-if="row.task_type === 'report'" link @click="openReport(row.report_week_key)">
                打开周报
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="toolbar history-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          background
          layout="total, prev, pager, next"
          :total="runsStore.list.length"
        />
      </div>
    </section>

    <EmptyState
      v-else
      title="没有历史记录"
      :description="runsStore.listError ?? '接口已连通，但当前筛选条件下没有匹配的运行记录。'"
    />
  </div>
</template>

<style scoped>
.history-page {
  gap: 14px;
}

.history-toolbar-panel {
  padding: 12px 14px;
}

.history-toolbar {
  align-items: center;
}

.history-table-panel {
  border-radius: var(--radius-panel);
  overflow: hidden;
}

.history-table-panel :deep(.el-table__header th) {
  font-size: 12px;
  letter-spacing: 0.02em;
  color: #405148;
}

.history-table-panel :deep(.el-table__cell) {
  padding: 9px 0;
}

.history-pagination {
  justify-content: flex-end;
  margin-top: 0;
  padding: 10px 12px;
  border-top: 1px solid var(--line);
  background: #f8faf7;
}
</style>
