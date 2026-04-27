<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import EmptyState from "@/components/EmptyState.vue";
import EndpointNotice from "@/components/EndpointNotice.vue";
import ProgressPanel from "@/components/ProgressPanel.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { isRunTerminalStatus, mapErrorCategoryLabel, mapRunTaskTypeLabel } from "@/services/contract";
import { useNoticesStore } from "@/stores/notices";
import { useRunsStore } from "@/stores/runs";

const route = useRoute();
const router = useRouter();
const runsStore = useRunsStore();
const noticesStore = useNoticesStore();

const runId = computed(() => route.params.runId as string);
const isTerminal = computed(() =>
  runsStore.currentRun ? isRunTerminalStatus(runsStore.currentRun.status) : false
);
const canCancel = computed(() => Boolean(runsStore.currentRun) && !isTerminal.value);
const canOpenReport = computed(
  () => Boolean(runsStore.currentRun) && isTerminal.value && runsStore.currentRun?.taskType === "report"
);

const cancelRun = async () => {
  try {
    await runsStore.cancelRun(runId.value);
    noticesStore.push({
      kind: "success",
      title: "任务已取消",
      message: "当前任务状态已更新。"
    });
  } catch {
    noticesStore.push({
      kind: "warning",
      title: "取消失败",
      message: runsStore.runError ?? "请稍后再试。"
    });
  }
};

const openReport = () => {
  router.push({
    name: "reports",
    query: runsStore.currentRun?.reportWeekKey ? { weekKey: runsStore.currentRun.reportWeekKey } : undefined
  });
};

onMounted(() => {
  void runsStore.watchRun(runId.value);
});

watch(
  () => runsStore.currentRun,
  (value) => {
    if (!value || !isRunTerminalStatus(value.status)) {
      return;
    }
    router.replace({
      name: "run-detail",
      params: { runId: runId.value }
    });
  }
);

onBeforeUnmount(() => {
  runsStore.stopWatching();
});
</script>

<template>
  <div class="page-stack">
    <el-skeleton v-if="runsStore.loadingRun && !runsStore.currentRun" animated :rows="6" />

    <EndpointNotice
      v-else-if="runsStore.runConnectionUnavailable"
      type="error"
      title="无法获取运行进度"
      :detail="runsStore.runError ?? '当前无法连接后端。'"
    />

    <EndpointNotice
      v-else-if="runsStore.runEndpointUnavailable"
      title="运行详情接口不可用"
      :detail="runsStore.runError ?? '当前后端构建没有暴露这个运行详情接口。'"
    />

    <article v-else-if="runsStore.currentRun" class="page-panel">
      <div class="page-heading">
        <div>
          <p class="panel-eyebrow">run_id</p>
          <h3>{{ runId }}</h3>
        </div>
        <StatusBadge :status="runsStore.currentRun.status" run />
      </div>

      <ProgressPanel :snapshot="runsStore.currentRun" :stream-mode="runsStore.streamMode" />

      <div class="meta-list">
        <div>
          <span>任务类型</span>
          <strong>{{ mapRunTaskTypeLabel(runsStore.currentRun.taskType) }}</strong>
        </div>
        <div>
          <span>成功 / 失败 / 跳过</span>
          <strong>
            {{ runsStore.currentRun.succeededItems }} / {{ runsStore.currentRun.failedItems }} /
            {{ runsStore.currentRun.skippedItems }}
          </strong>
        </div>
        <div>
          <span>错误分类</span>
          <strong>{{ mapErrorCategoryLabel(runsStore.currentRun.errorCategory) }}</strong>
        </div>
        <div>
          <span>错误信息</span>
          <strong>{{ runsStore.currentRun.errorMessage ?? "无" }}</strong>
        </div>
      </div>

      <div class="page-panel__actions">
        <el-button plain type="danger" :disabled="!canCancel" @click="cancelRun">取消任务</el-button>
        <el-button plain @click="router.push({ name: 'history' })">查看历史记录</el-button>
        <el-button type="primary" :disabled="!canOpenReport" @click="openReport">查看周报</el-button>
      </div>

      <EndpointNotice
        v-if="isTerminal && runsStore.currentRun.taskType !== 'report'"
        type="info"
        title="总结任务已完成"
        detail="可以继续前往历史记录或运行详情页，再进入结果详情。"
      />
    </article>

    <EmptyState
      v-else
      title="运行详情尚未加载"
      :description="runsStore.runError ?? '请返回历史记录后重试。'"
      action-text="查看历史记录"
      @action="router.push({ name: 'history' })"
    />
  </div>
</template>
