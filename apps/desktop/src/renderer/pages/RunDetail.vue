<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import EmptyState from "@/components/EmptyState.vue";
import EndpointNotice from "@/components/EndpointNotice.vue";
import MetricCard from "@/components/MetricCard.vue";
import ProgressPanel from "@/components/ProgressPanel.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { ApiError, NetworkError, api } from "@/services/api";
import { openPath } from "@/services/desktop-bridge";
import { formatDateTime } from "@/services/format";
import {
  mapErrorCategoryLabel,
  mapRunStageLabel,
  mapRunTaskTypeLabel,
  normalizeRunSnapshot
} from "@/services/contract";
import { useNoticesStore } from "@/stores/notices";
import type { UiRunSnapshot } from "@/types";

const route = useRoute();
const router = useRouter();
const noticesStore = useNoticesStore();
const snapshot = ref<UiRunSnapshot | null>(null);
const loading = ref(false);
const endpointUnavailable = ref(false);
const connectionUnavailable = ref(false);
const error = ref<string | null>(null);
const resultSnapshots = computed(() => snapshot.value?.resultSnapshots ?? []);

const load = async () => {
  loading.value = true;
  error.value = null;

  try {
    snapshot.value = normalizeRunSnapshot(await api.getRun(route.params.runId as string));
    endpointUnavailable.value = false;
    connectionUnavailable.value = false;
  } catch (errorValue) {
    endpointUnavailable.value = errorValue instanceof ApiError && errorValue.endpointUnavailable;
    connectionUnavailable.value = errorValue instanceof NetworkError;
    error.value = (errorValue as Error).message;
    snapshot.value = null;
  } finally {
    loading.value = false;
  }
};

const openResultDetail = (snapshotId: string) => {
  router.push({
    name: "item-detail",
    params: { snapshotId },
    query: { runId: String(route.params.runId) }
  });
};

const openSummaryMarkdown = async (targetPath?: string | null) => {
  if (!targetPath) {
    noticesStore.push({
      kind: "warning",
      title: "找不到摘要 MD",
      message: "当前结果没有可打开的摘要 markdown 文件。"
    });
    return;
  }
  const result = await openPath(targetPath);
  if (result) {
    noticesStore.push({
      kind: "warning",
      title: "找不到摘要 MD",
      message: result
    });
  }
};

const openReport = () => {
  router.push({
    name: "reports",
    query: snapshot.value?.reportWeekKey ? { weekKey: snapshot.value.reportWeekKey } : undefined
  });
};

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page-stack">
    <section class="metric-grid">
      <MetricCard label="run_id" :value="String(route.params.runId)" />
      <MetricCard label="读取状态" :value="loading ? '加载中' : snapshot ? '已加载' : '加载失败'" />
    </section>

    <EndpointNotice
      v-if="connectionUnavailable"
      type="error"
      title="无法获取运行详情"
      :detail="error ?? '当前无法连接后端。'"
    />

    <EndpointNotice
      v-else-if="endpointUnavailable"
      title="运行详情接口不可用"
      :detail="error ?? '当前后端构建没有暴露这个运行详情接口。'"
    />

    <article v-else-if="snapshot" class="page-panel">
      <div class="page-heading">
        <div>
          <p class="panel-eyebrow">运行详情</p>
          <h3>{{ mapRunStageLabel(snapshot.stage) }}</h3>
        </div>
        <StatusBadge :status="snapshot.status" run />
      </div>

      <ProgressPanel :snapshot="snapshot" stream-mode="idle" />

      <div class="meta-list">
        <div>
          <span>任务类型</span>
          <strong>{{ mapRunTaskTypeLabel(snapshot.taskType) }}</strong>
        </div>
        <div>
          <span>错误分类</span>
          <strong>{{ mapErrorCategoryLabel(snapshot.errorCategory) }}</strong>
        </div>
        <div>
          <span>错误信息</span>
          <strong>{{ snapshot.errorMessage ?? "无" }}</strong>
        </div>
        <div>
          <span>当前条目</span>
          <strong>{{ snapshot.currentItemLabel ?? "未提供" }}</strong>
        </div>
        <div>
          <span>更新时间</span>
          <strong>{{ formatDateTime(snapshot.updatedAt) }}</strong>
        </div>
      </div>

      <article v-if="snapshot.taskType === 'summary'" class="surface-card">
        <p class="panel-eyebrow">本次产出</p>
        <h3>结果快照</h3>
        <p class="secondary-text">
          这里展示当前 run 实际生成的结果。旧失败 run 仍会保留在历史记录里，但不会混进这次成功 run 的详情。
        </p>

        <div v-if="resultSnapshots.length" class="page-stack">
          <article
            v-for="result in resultSnapshots"
            :key="result.snapshot_id"
            class="surface-card surface-card--nested"
          >
            <div class="page-heading">
              <div>
                <h3>{{ result.title }}</h3>
                <p class="secondary-text">
                  {{ result.final_category || "待分类" }}
                  <span v-if="result.created_at"> · {{ formatDateTime(result.created_at) }}</span>
                </p>
                <p v-if="result.markdown_filename" class="secondary-text">
                  文件 {{ result.markdown_filename }}
                </p>
              </div>
              <div class="toolbar__group">
                <el-button
                  v-if="result.markdown_path"
                  plain
                  @click="openSummaryMarkdown(result.markdown_path)"
                >
                  打开摘要 MD
                </el-button>
                <el-button plain type="primary" @click="openResultDetail(result.snapshot_id)">
                  查看结果
                </el-button>
              </div>
            </div>
          </article>
        </div>

        <EmptyState
          v-else
          title="本次运行没有生成结果快照"
          description="如果这是失败 run，请查看上面的错误信息；如果刚刚完成，请刷新一次详情页。"
        />
      </article>

      <div class="page-panel__actions">
        <el-button type="primary" plain @click="router.push({ name: 'summary-confirm' })">
          再次总结
        </el-button>
        <el-button plain @click="router.push({ name: 'history' })">返回历史记录</el-button>
        <el-button v-if="snapshot.taskType === 'report'" plain @click="openReport">查看周报中心</el-button>
      </div>
    </article>

    <EmptyState
      v-else
      title="运行详情加载失败"
      :description="error ?? '请稍后再试。'"
      action-text="返回历史记录"
      @action="router.push({ name: 'history' })"
    />
  </div>
</template>
