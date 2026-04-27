<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ArrowRight } from "@element-plus/icons-vue";

import EmptyState from "@/components/EmptyState.vue";
import EndpointNotice from "@/components/EndpointNotice.vue";
import MetricCard from "@/components/MetricCard.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { deriveSourceLabel, mapRunStageLabel, mapSourceTypeLabel } from "@/services/contract";
import { useConfigStore } from "@/stores/config";
import { usePoolStore } from "@/stores/pool";
import { useRunsStore } from "@/stores/runs";

const router = useRouter();
const configStore = useConfigStore();
const poolStore = usePoolStore();
const runsStore = useRunsStore();

const latestRun = computed(() => runsStore.list[0] ?? null);
const historyStatus = computed(() => {
  if (runsStore.listConnectionUnavailable) {
    return "后端离线";
  }
  if (runsStore.historyUnavailable) {
    return "接口缺失";
  }
  if (runsStore.hasLoadedList) {
    return "可用";
  }
  return "加载中";
});

onMounted(() => {
  void configStore.load();
  void poolStore.fetchItems();
  void runsStore.loadRunsList();
});
</script>

<template>
  <div class="page-stack">
    <section class="metric-grid">
      <MetricCard label="待处理条目" :value="poolStore.pendingItems.length" note="来自当前总结池" />
      <MetricCard label="历史接口状态" :value="historyStatus" />
      <MetricCard
        label="主链路状态"
        :value="configStore.generationReady ? (poolStore.pendingItems.length > 0 ? '可启动' : '等待条目') : '待处理'"
        :note="configStore.generationReady ? '点击后进入总结确认页' : configStore.generationBlockReason"
      />
    </section>

    <section class="split-layout">
      <article class="page-panel">
        <div class="page-heading">
          <div>
            <p class="panel-eyebrow">总结任务</p>
            <h3>开始新的总结任务</h3>
          </div>
          <el-button
            type="primary"
            :disabled="poolStore.pendingItems.length === 0 || !configStore.generationReady"
            @click="router.push({ name: 'summary-confirm' })"
          >
            开始总结
          </el-button>
        </div>

        <EndpointNotice
          v-if="!configStore.generationReady"
          type="warning"
          title="生成链路尚未就绪"
          :detail="configStore.generationBlockReason"
        />

        <el-skeleton v-if="poolStore.loading && !poolStore.hasLoaded" animated :rows="5" />

        <EndpointNotice
          v-else-if="poolStore.connectionUnavailable"
          type="error"
          title="无法读取总结池"
          :detail="poolStore.error ?? '当前无法连接后端。'"
        />

        <EmptyState
          v-else-if="poolStore.pendingItems.length === 0"
          title="当前没有待处理条目"
          description="请先往总结池中添加内容，再开始新的总结任务。"
          action-text="前往总结池"
          @action="router.push({ name: 'pool' })"
        />

        <div v-else class="pool-card-grid">
          <article v-for="item in poolStore.pendingItems.slice(0, 4)" :key="item.id" class="pool-item-card">
            <div class="page-heading">
              <div>
                <p class="panel-eyebrow">{{ mapSourceTypeLabel(item.source_type) }}</p>
                <h3>{{ deriveSourceLabel(item) }}</h3>
              </div>
              <StatusBadge :status="item.current_status" />
            </div>
            <p class="secondary-text">{{ item.source_value }}</p>
          </article>
        </div>
      </article>

      <aside class="sticky-column">
        <article class="surface-card">
          <div class="page-heading">
            <div>
              <p class="panel-eyebrow">最近运行</p>
              <h3>最近一次总结或周报任务</h3>
            </div>
            <el-button plain @click="router.push({ name: 'history' })">查看历史</el-button>
          </div>

          <el-skeleton v-if="runsStore.loadingList && !runsStore.hasLoadedList" animated :rows="3" />

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

          <div v-else-if="latestRun">
            <StatusBadge :status="latestRun.status" run />
            <p class="secondary-text">{{ mapRunStageLabel(latestRun.stage) }}</p>
            <el-button
              type="primary"
              plain
              :icon="ArrowRight"
              @click="router.push({ name: 'run-detail', params: { runId: latestRun.run_id } })"
            >
              查看运行详情
            </el-button>
          </div>

          <EmptyState
            v-else
            title="还没有运行记录"
            description="历史接口已连通，但当前还没有可展示的运行记录。"
          />
        </article>

        <article class="surface-card">
          <p class="panel-eyebrow">周报</p>
          <h3>周报中心已可用</h3>
          <p class="secondary-text">
            现在可以进入周报中心查看预检查信息、版本列表和周报内容。
          </p>
          <el-button type="primary" plain @click="router.push({ name: 'reports' })">
            打开周报中心
          </el-button>
        </article>
      </aside>
    </section>
  </div>
</template>
