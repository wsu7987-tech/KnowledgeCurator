<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import EmptyState from "@/components/EmptyState.vue";
import EndpointNotice from "@/components/EndpointNotice.vue";
import MetricCard from "@/components/MetricCard.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { ApiError, NetworkError, api } from "@/services/api";
import { formatDateTime } from "@/services/format";
import { mapSourceTypeLabel } from "@/services/contract";
import { useConfigStore } from "@/stores/config";
import { useNoticesStore } from "@/stores/notices";
import type { SummaryPrecheckResponse } from "@/types";

const router = useRouter();
const configStore = useConfigStore();
const noticesStore = useNoticesStore();

const precheck = ref<SummaryPrecheckResponse | null>(null);
const selectedIds = ref<string[]>([]);
const loading = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);
const endpointUnavailable = ref(false);
const connectionUnavailable = ref(false);

const groupedItems = computed(() => {
  const items = precheck.value?.items ?? [];
  return items.reduce<Record<string, typeof items>>((groups, item) => {
    groups[item.source_type] ??= [];
    groups[item.source_type].push(item);
    return groups;
  }, {});
});

const selectedCount = computed(() => selectedIds.value.length);
const selectableIds = computed(() => (precheck.value?.items ?? []).map((item) => item.id));
const allSelected = computed(
  () => selectableIds.value.length > 0 && selectedIds.value.length === selectableIds.value.length
);
const runHintText = computed(() => {
  const hint = precheck.value?.run_hint ?? "";
  const match = /^Ready to summarize (\d+) item\(s\)$/.exec(hint);
  if (match) {
    return `已准备好处理 ${match[1]} 项内容`;
  }

  return hint;
});

const toggleSelectAll = (checked: boolean) => {
  selectedIds.value = checked ? [...selectableIds.value] : [];
};

const mapCleaningLevelLabel = (cleaningLevel?: string | null) => {
  switch (cleaningLevel) {
    case "enhanced":
      return "增强清洗";
    case "basic":
      return "基础清洗";
    default:
      return "未标记";
  }
};

const loadPrecheck = async () => {
  loading.value = true;
  error.value = null;
  endpointUnavailable.value = false;
  connectionUnavailable.value = false;

  try {
    precheck.value = await api.getSummaryPrecheck();
    selectedIds.value = precheck.value.items.map((item) => item.id);
  } catch (errorValue) {
    endpointUnavailable.value = errorValue instanceof ApiError && errorValue.endpointUnavailable;
    connectionUnavailable.value = errorValue instanceof NetworkError;
    error.value = (errorValue as Error).message;
  } finally {
    loading.value = false;
  }
};

const startSummary = async () => {
  if (selectedIds.value.length === 0) {
    return;
  }

  submitting.value = true;
  try {
    const response = await api.createSummaryRun(selectedIds.value);
    router.push({
      name: "summary-progress",
      params: { runId: response.run_id }
    });
  } catch (errorValue) {
    noticesStore.push({
      kind: "error",
      title: "启动总结失败",
      message: (errorValue as Error).message
    });
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  void loadPrecheck();
  void configStore.load();
});
</script>

<template>
  <div class="page-stack">
    <section class="metric-grid">
      <MetricCard label="预检查条目数" :value="precheck?.count ?? 0" />
      <MetricCard label="已勾选" :value="selectedCount" note="会进入 `pool_ids[]` 请求体" />
      <MetricCard label="输出目录" :value="precheck?.output_dir ?? configStore.data?.summary_output_dir ?? '未返回'" />
      <MetricCard
        label="生成链路"
        :value="configStore.generationReady ? '已就绪' : '待处理'"
        :note="configStore.generationReady ? 'LLM 与 Embedding 已通过检测' : configStore.generationBlockReason"
      />
    </section>

    <section class="split-layout">
      <article class="page-panel">
        <div class="page-heading">
          <div>
            <p class="panel-eyebrow">预检查</p>
            <h3>开始总结前的确认清单</h3>
            <p class="secondary-text">已选 {{ selectedCount }} / {{ precheck?.count ?? 0 }} 项</p>
          </div>
          <div class="toolbar__group">
            <el-button plain @click="router.push({ name: 'runs' })">返回开始总结</el-button>
            <el-button
              type="primary"
              :loading="submitting"
              :disabled="selectedCount === 0 || !configStore.generationReady"
              @click="startSummary"
            >
              确认并开始
            </el-button>
          </div>
        </div>

        <EndpointNotice
          v-if="!configStore.generationReady"
          type="warning"
          title="生成链路尚未就绪"
          :detail="configStore.generationBlockReason"
        />

        <el-skeleton v-if="loading" animated :rows="6" />

        <EndpointNotice
          v-else-if="connectionUnavailable"
          type="error"
          title="无法连接后端"
          detail="总结确认页依赖本地后端服务，请先启动后端后再重试。"
        />

        <EndpointNotice
          v-else-if="endpointUnavailable"
          title="总结预检查接口不可用"
          detail="后端可以访问，但当前构建还没有暴露 /api/summary/precheck。"
        />

        <div v-else-if="precheck && precheck.items.length" class="page-stack">
          <article class="surface-card">
            <div class="page-heading">
              <div>
                <p class="panel-eyebrow">选择范围</p>
                <h3>将进入本次总结的条目</h3>
              </div>
              <el-checkbox :model-value="allSelected" @change="toggleSelectAll">
                全选
              </el-checkbox>
            </div>
            <p class="secondary-text">
              当前只展示待总结或失败可重试的条目；已完成条目不会再出现在这里。
            </p>
          </article>

          <article
            v-for="(items, sourceType) in groupedItems"
            :key="sourceType"
            class="surface-card"
          >
            <div class="page-heading">
              <div>
                <p class="panel-eyebrow">{{ mapSourceTypeLabel(sourceType) }}</p>
                <h3>来源分组</h3>
              </div>
              <span class="secondary-text">{{ items.length }} 项</span>
            </div>

            <el-checkbox-group v-model="selectedIds" class="page-stack">
              <el-checkbox v-for="item in items" :key="item.id" :label="item.id" border>
              <div>
                  <strong>{{ item.title }}</strong>
                  <div class="selection-row">
                    <StatusBadge :status="item.current_status" />
                    <span class="secondary-text">{{ mapCleaningLevelLabel(item.cleaning_level) }}</span>
                    <span class="secondary-text">{{ item.id }}</span>
                  </div>
                </div>
              </el-checkbox>
            </el-checkbox-group>
          </article>
        </div>

        <EmptyState
          v-else
          title="没有可执行的待处理项"
          :description="error ?? '当前预检查没有返回可处理内容。'"
          action-text="回到总结池"
          @action="router.push({ name: 'pool' })"
        />
      </article>

      <aside class="sticky-column">
        <article class="surface-card">
          <p class="panel-eyebrow">路径一致性</p>
          <h3>导出目录来自统一配置</h3>
          <p class="secondary-text">
            前端不会自行推导真实存储位置；显示值优先来自 `/api/summary/precheck`，
            其次来自 `/api/config`。
          </p>
          <div class="meta-list">
            <div>
              <span>总结输出</span>
              <strong>{{ configStore.data?.summary_output_dir ?? "等待配置返回" }}</strong>
            </div>
            <div>
              <span>周报输出</span>
              <strong>{{ configStore.data?.report_output_dir ?? "等待配置返回" }}</strong>
            </div>
            <div v-if="configStore.llmStatus.checkedAt">
              <span>LLM 检测</span>
              <strong>{{ formatDateTime(configStore.llmStatus.checkedAt) }}</strong>
            </div>
            <div v-if="configStore.embeddingStatus.checkedAt">
              <span>Embedding 检测</span>
              <strong>{{ formatDateTime(configStore.embeddingStatus.checkedAt) }}</strong>
            </div>
          </div>
        </article>

        <article class="surface-card" v-if="runHintText">
          <p class="panel-eyebrow">后端提示</p>
          <h3>{{ runHintText }}</h3>
          <p v-if="precheck?.failed_retry_count" class="secondary-text">
            包含 {{ precheck.failed_retry_count }} 项失败重试内容。
          </p>
        </article>
      </aside>
    </section>
  </div>
</template>
