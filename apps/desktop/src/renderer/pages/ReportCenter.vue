<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue";
import MarkdownIt from "markdown-it";
import { useRoute, useRouter } from "vue-router";
import type { EChartsOption } from "echarts";

import ChartSurface from "@/components/ChartSurface.vue";
import EmptyState from "@/components/EmptyState.vue";
import EndpointNotice from "@/components/EndpointNotice.vue";
import { openPath, saveTextFile } from "@/services/desktop-bridge";
import { formatCount, formatDateTime } from "@/services/format";
import { formatWeekLabel, mapSourceTypeLabel } from "@/services/contract";
import { extractReportSeries } from "@/services/report-visuals";
import { api } from "@/services/api";
import { useConfigStore } from "@/stores/config";
import { useNoticesStore } from "@/stores/notices";
import { useReportsStore } from "@/stores/reports";
import type { ReportGroundedItem, ReportSnapshotItem, ReportVersionDetail } from "@/types";

const router = useRouter();
const route = useRoute();
const configStore = useConfigStore();
const reportsStore = useReportsStore();
const noticesStore = useNoticesStore();
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
});

const selectedWeek = shallowRef("");
const selectedVersion = shallowRef<number | null>(null);
const isOpeningGeneratedReport = shallowRef(false);
const previousReport = shallowRef<ReportVersionDetail | null>(null);
const comparisonLoading = shallowRef(false);
const comparisonError = shallowRef<string | null>(null);

const renderedMarkdown = computed(() =>
  reportsStore.activeReport?.markdown_content
    ? md.render(reportsStore.activeReport.markdown_content)
    : ""
);

const activePayload = computed(() => reportsStore.activeReport?.snapshot_payload ?? null);
const chartSeries = computed(() => extractReportSeries(activePayload.value));
const reportItems = computed<ReportSnapshotItem[]>(() => activePayload.value?.items ?? []);
const reportGroundedItems = computed<ReportGroundedItem[]>(
  () => activePayload.value?.grounded_items?.slice(0, 8) ?? []
);
const totalEvidenceCount = computed(() => activePayload.value?.evidence_citation_total ?? 0);
const totalGroundedClaimCount = computed(() => activePayload.value?.grounded_claim_total ?? 0);
const totalMemoryContextCount = computed(() =>
  reportItems.value.reduce((total, item) => total + item.memory_context_count, 0)
);
const reportSourceSummary = computed(() =>
  chartSeries.value.sources
    .map((item) => `${mapSourceTypeLabel(item.name)} ${formatCount(item.value)}`)
    .join("、")
);
const previousVersion = computed(() => {
  if (selectedVersion.value === null) {
    return null;
  }
  return (
    reportsStore.versions
      .map((item) => item.version)
      .filter((version) => version < selectedVersion.value!)
      .sort((left, right) => right - left)[0] ?? null
  );
});
const previousReportItems = computed<ReportSnapshotItem[]>(
  () => previousReport.value?.snapshot_payload?.items ?? []
);
const comparison = computed(() => {
  if (!previousReport.value) {
    return null;
  }
  const previousById = new Map(previousReportItems.value.map((item) => [item.snapshot_id, item]));
  const currentById = new Map(reportItems.value.map((item) => [item.snapshot_id, item]));
  const addedItems = reportItems.value.filter((item) => !previousById.has(item.snapshot_id));
  const removedItems = previousReportItems.value.filter((item) => !currentById.has(item.snapshot_id));
  const retainedItems = reportItems.value.filter((item) => previousById.has(item.snapshot_id));

  return {
    addedItems,
    removedItems,
    retainedItems,
    itemDelta: reportItems.value.length - previousReportItems.value.length,
    evidenceDelta:
      totalEvidenceCount.value -
      (previousReport.value.snapshot_payload?.evidence_citation_total ?? 0),
    claimDelta:
      totalGroundedClaimCount.value -
      (previousReport.value.snapshot_payload?.grounded_claim_total ?? 0)
  };
});
const comparisonHighlights = computed(() => {
  if (!comparison.value) {
    return [];
  }
  return [
    `结果条目 ${formatSignedCount(comparison.value.itemDelta)} 条`,
    `原文证据 ${formatSignedCount(comparison.value.evidenceDelta)} 条`,
    `可引用结论 ${formatSignedCount(comparison.value.claimDelta)} 条`,
    `保留条目 ${formatCount(comparison.value.retainedItems.length)} 条`
  ];
});
const comparisonAddedPreview = computed(() => comparison.value?.addedItems.slice(0, 4) ?? []);
const comparisonRemovedPreview = computed(() => comparison.value?.removedItems.slice(0, 4) ?? []);

const isInitialLoading = computed(() => reportsStore.loading && !reportsStore.hasLoadedPrecheck);
const hasAvailableWeeks = computed(
  () => (reportsStore.precheck?.available_week_keys?.length ?? 0) > 0
);
const hasVersions = computed(() => reportsStore.versions.length > 0);
const versionEmptyState = computed(
  () =>
    hasAvailableWeeks.value &&
    !reportsStore.loading &&
    !reportsStore.error &&
    selectedWeek.value.length > 0 &&
    !hasVersions.value
);
const detailEmptyState = computed(
  () =>
    hasVersions.value &&
    !reportsStore.loading &&
    !reportsStore.error &&
    !reportsStore.activeReport &&
    selectedVersion.value !== null
);

const reportMeta = computed(() => {
  if (!reportsStore.activeReport) {
    return "";
  }

  const parts = [
    reportsStore.activeReport.generated_at
      ? `生成时间 ${formatDateTime(reportsStore.activeReport.generated_at)}`
      : "",
    reportsStore.activeReport.markdown_path ? `文件 ${reportsStore.activeReport.markdown_path}` : ""
  ].filter(Boolean);

  return parts.join(" · ");
});

const categoryOption = computed<EChartsOption>(() => ({
  tooltip: {},
  xAxis: { type: "category" as const, data: chartSeries.value.categories.map((item) => item.name) },
  yAxis: { type: "value" as const },
  series: [
    {
      data: chartSeries.value.categories.map((item) => item.value),
      type: "bar" as const,
      itemStyle: { color: "#1f7a5a" }
    }
  ]
}));

const sourceOption = computed<EChartsOption>(() => ({
  tooltip: {},
  series: [
    {
      type: "pie" as const,
      radius: ["38%", "64%"],
      data: chartSeries.value.sources.map((item) => ({
        name: mapSourceTypeLabel(item.name),
        value: item.value
      }))
    }
  ]
}));

const trendOption = computed<EChartsOption>(() => ({
  tooltip: {},
  xAxis: { type: "category" as const, data: chartSeries.value.trends.map((item) => item.name) },
  yAxis: { type: "value" as const },
  series: [
    {
      data: chartSeries.value.trends.map((item) => item.value),
      type: "line" as const,
      smooth: true,
      areaStyle: { color: "rgba(217,130,43,0.16)" },
      lineStyle: { color: "#d9822b" }
    }
  ]
}));

const loadPreviousReport = async () => {
  previousReport.value = null;
  comparisonError.value = null;
  if (!selectedWeek.value || previousVersion.value === null) {
    return;
  }

  comparisonLoading.value = true;
  try {
    previousReport.value = await api.getReportVersion(selectedWeek.value, previousVersion.value);
  } catch (errorValue) {
    comparisonError.value = (errorValue as Error).message;
  } finally {
    comparisonLoading.value = false;
  }
};

watch(selectedWeek, async (weekKey) => {
  if (isOpeningGeneratedReport.value) {
    return;
  }
  selectedVersion.value = null;

  if (!weekKey) {
    return;
  }

  const queryVersion =
    typeof route.query.version === "string" ? Number(route.query.version) : Number.NaN;
  await router.replace({
    query: {
      ...route.query,
      weekKey,
      version: undefined
    }
  });
  await reportsStore.loadVersions(weekKey);
  if (reportsStore.versions.length > 0) {
    selectedVersion.value =
      reportsStore.versions.find((item) => item.version === queryVersion)?.version
      ?? reportsStore.versions[0].version;
  }
  await loadPreviousReport();
});

watch(selectedVersion, async (version) => {
  if (isOpeningGeneratedReport.value) {
    return;
  }
  if (!selectedWeek.value || version === null) {
    return;
  }

  await router.replace({
    query: {
      ...route.query,
      weekKey: selectedWeek.value,
      version: String(version)
    }
  });
  await reportsStore.loadReport(selectedWeek.value, version);
  await loadPreviousReport();
});

const triggerGeneration = async () => {
  try {
    const response = await reportsStore.createReport(selectedWeek.value || undefined);
    noticesStore.push({
      kind: "success",
      title: "周报已生成",
      message: `${formatWeekLabel(response.week_key)} 第 ${response.version} 版已打开。`
    });
    isOpeningGeneratedReport.value = true;
    try {
      selectedWeek.value = response.week_key;
      await reportsStore.loadPrecheck();
      await reportsStore.loadVersions(response.week_key);
      selectedVersion.value = response.version;
      await reportsStore.loadReport(response.week_key, response.version);
      await loadPreviousReport();
      await router.replace({
        query: {
          ...route.query,
          weekKey: response.week_key,
          version: String(response.version)
        }
      });
    } finally {
      isOpeningGeneratedReport.value = false;
    }
  } catch {
    noticesStore.push({
      kind: "warning",
      title: "周报生成失败",
      message: reportsStore.error ?? "周报任务创建失败。"
    });
  }
};

const openReportMarkdown = async () => {
  const targetPath = reportsStore.activeReport?.markdown_path;
  if (!targetPath) {
    noticesStore.push({
      kind: "warning",
      title: "找不到周报文件",
      message: "当前周报没有返回 markdown 文件路径。"
    });
    return;
  }
  const result = await openPath(targetPath);
  if (result) {
    noticesStore.push({
      kind: "warning",
      title: "打开周报失败",
      message: result
    });
  }
};

const copyReportMarkdown = async () => {
  const content = reportsStore.activeReport?.markdown_content ?? "";
  if (!content.trim() || !navigator.clipboard?.writeText) {
    noticesStore.push({
      kind: "warning",
      title: "复制失败",
      message: "当前环境无法写入剪贴板，或周报正文为空。"
    });
    return;
  }
  try {
    await navigator.clipboard.writeText(content);
    noticesStore.push({
      kind: "success",
      title: "已复制周报",
      message: "Markdown 正文已写入剪贴板。"
    });
  } catch {
    noticesStore.push({
      kind: "warning",
      title: "复制失败",
      message: "当前环境拒绝写入剪贴板。"
    });
  }
};

const saveReportMarkdown = async () => {
  const content = reportsStore.activeReport?.markdown_content ?? "";
  if (!content.trim()) {
    noticesStore.push({
      kind: "warning",
      title: "无法另存",
      message: "当前周报正文为空。"
    });
    return;
  }
  const savedPath = await saveTextFile({
    title: "另存周报 Markdown",
    defaultPath: `${sanitizeFilenameStem(`${selectedWeek.value || "周报"}-第${selectedVersion.value ?? 1}版`)}.md`,
    content,
    filters: [{ name: "Markdown", extensions: ["md"] }]
  });
  if (!savedPath) {
    return;
  }
  noticesStore.push({
    kind: "success",
    title: "周报已另存",
    message: savedPath
  });
};

const openResultDetail = (snapshotId: string) => {
  router.push({
    name: "item-detail",
    params: { snapshotId }
  });
};

onMounted(async () => {
  await configStore.load();
  await reportsStore.loadPrecheck();
  selectedWeek.value =
    (typeof route.query.weekKey === "string" ? route.query.weekKey : "")
    || reportsStore.precheck?.week_key
    || reportsStore.precheck?.available_week_keys?.[0]
    || "";
});

function formatSignedCount(value: number) {
  if (value > 0) {
    return `+${formatCount(value)}`;
  }
  return formatCount(value);
}

function sanitizeFilenameStem(value: string) {
  const normalized = value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
  return normalized.replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80) || "周报";
}
</script>

<template>
  <div class="page-stack report-page">
    <section class="page-panel report-toolbar-panel">
      <div class="toolbar report-toolbar">
        <div class="toolbar__group">
          <el-select
            v-model="selectedWeek"
            aria-label="选择周次"
            placeholder="选择周次"
            style="width: 220px"
            :disabled="isInitialLoading || !hasAvailableWeeks"
          >
            <el-option
              v-for="weekKey in reportsStore.precheck?.available_week_keys ?? []"
              :key="weekKey"
              :label="formatWeekLabel(weekKey)"
              :value="weekKey"
            />
          </el-select>

          <el-select
            v-model="selectedVersion"
            aria-label="选择版本"
            placeholder="选择版本"
            style="width: 180px"
            :disabled="!hasVersions"
          >
            <el-option
              v-for="version in reportsStore.versions"
              :key="version.version"
              :label="`第 ${version.version} 版`"
              :value="version.version"
            />
          </el-select>
        </div>

        <div class="toolbar__group">
          <el-button
            plain
            :disabled="!reportsStore.activeReport"
            @click="copyReportMarkdown"
          >
            复制正文
          </el-button>
          <el-button
            plain
            :disabled="!reportsStore.activeReport?.markdown_path"
            @click="openReportMarkdown"
          >
            打开文件
          </el-button>
          <el-button
            plain
            :disabled="!reportsStore.activeReport"
            @click="saveReportMarkdown"
          >
            另存为
          </el-button>
          <el-button
            type="primary"
            :loading="reportsStore.generating"
            :disabled="reportsStore.connectionUnavailable || !configStore.generationReady"
            @click="triggerGeneration"
          >
            生成周报
          </el-button>
        </div>
      </div>
    </section>

    <EndpointNotice
      v-if="!configStore.generationReady && !isInitialLoading"
      type="warning"
      title="周报生成链路尚未就绪"
      :detail="configStore.generationBlockReason"
    />

    <EmptyState
      v-if="isInitialLoading"
      title="正在加载周报中心"
      description="正在获取可用周次、版本列表和最新周报。"
    />

    <EndpointNotice
      v-else-if="reportsStore.connectionUnavailable"
      type="error"
      title="无法连接后端"
      detail="周报中心依赖本地后端服务，请先启动后端后再重试。"
    />

    <EndpointNotice
      v-else-if="reportsStore.endpointUnavailable"
      type="warning"
      title="周报接口不可用"
      detail="后端可以访问，但当前构建还没有暴露周报相关接口。"
    />

    <EmptyState
      v-else-if="!hasAvailableWeeks"
      title="暂时没有可用周次"
      description="请先完成至少一批总结结果，再生成或查看周报。"
    />

    <EmptyState
      v-else-if="versionEmptyState"
      title="这一周还没有周报版本"
      description="可以使用上方按钮为当前周次生成第一个周报版本。"
    />

    <EmptyState
      v-else-if="detailEmptyState"
      title="周报版本加载失败"
      :description="reportsStore.error ?? '请切换其他版本，或稍后再试。'"
    />

    <section v-else-if="reportsStore.activeReport" class="split-layout report-workbench">
      <article class="page-panel report-document">
        <div class="page-heading">
          <div>
            <p class="panel-eyebrow">周报</p>
            <h3>{{ selectedWeek ? formatWeekLabel(selectedWeek) : "最新版本" }}</h3>
          </div>
          <span class="secondary-text">版本 {{ selectedVersion }}</span>
        </div>

        <p v-if="reportMeta" class="secondary-text">{{ reportMeta }}</p>
        <section class="report-metrics" aria-label="周报概览指标">
          <div class="report-metric">
            <span>结果条目</span>
            <strong>{{ formatCount(reportItems.length) }}</strong>
          </div>
          <div class="report-metric">
            <span>原文证据</span>
            <strong>{{ formatCount(totalEvidenceCount) }}</strong>
          </div>
          <div class="report-metric">
            <span>辅助摘要</span>
            <strong>{{ formatCount(totalMemoryContextCount) }}</strong>
          </div>
          <div class="report-metric">
            <span>可引用结论</span>
            <strong>{{ formatCount(totalGroundedClaimCount) }}</strong>
          </div>
        </section>
        <section class="report-preview" aria-labelledby="report-preview-title">
          <h3 id="report-preview-title" class="visually-hidden">周报正文</h3>
          <div v-html="renderedMarkdown"></div>
        </section>
      </article>

      <aside class="sticky-column report-side">
        <article class="surface-card report-chart-card">
          <p class="panel-eyebrow">图表</p>
          <p v-if="reportSourceSummary" class="secondary-text report-source-summary">
            {{ reportSourceSummary }}
          </p>
          <div class="chart-stack">
            <ChartSurface :option="categoryOption" aria-label="分类分布图表" />
            <p class="chart-data-summary">
              分类分布：
              <span v-for="item in chartSeries.categories" :key="item.name">
                {{ item.name }} {{ formatCount(item.value) }}
              </span>
            </p>
            <ChartSurface :option="sourceOption" aria-label="来源分布图表" />
            <p class="chart-data-summary">
              来源分布：
              <span v-for="item in chartSeries.sources" :key="item.name">
                {{ mapSourceTypeLabel(item.name) }} {{ formatCount(item.value) }}
              </span>
            </p>
            <ChartSurface :option="trendOption" aria-label="阅读趋势图表" />
            <p class="chart-data-summary">
              阅读趋势：
              <span v-for="item in chartSeries.trends" :key="item.name">
                {{ item.name }} {{ formatCount(item.value) }}
              </span>
            </p>
          </div>
        </article>

        <article class="surface-card report-compare-card">
          <div class="page-heading">
            <div>
              <p class="panel-eyebrow">版本对比</p>
              <h3>
                <template v-if="previousVersion !== null">
                  相比第 {{ previousVersion }} 版
                </template>
                <template v-else>
                  当前是首版
                </template>
              </h3>
            </div>
            <span v-if="comparisonLoading" class="secondary-text">正在计算</span>
          </div>

          <p v-if="comparisonError" class="secondary-text">
            暂时无法读取上一版：{{ comparisonError }}
          </p>
          <p v-else-if="previousVersion === null" class="secondary-text">
            这一周还没有更早的版本，后续生成新版本后会自动展示变化。
          </p>
          <template v-else-if="comparison">
            <div class="report-compare-metrics">
              <span v-for="entry in comparisonHighlights" :key="entry">{{ entry }}</span>
            </div>
            <div class="report-compare-lists">
              <section>
                <h4>新增条目</h4>
                <p v-if="comparisonAddedPreview.length === 0" class="secondary-text">无新增条目</p>
                <template v-else>
                  <button
                    v-for="item in comparisonAddedPreview"
                    :key="item.snapshot_id"
                    type="button"
                    @click="openResultDetail(item.snapshot_id)"
                  >
                    {{ item.title }}
                  </button>
                </template>
              </section>
              <section>
                <h4>移出条目</h4>
                <p v-if="comparisonRemovedPreview.length === 0" class="secondary-text">无移出条目</p>
                <template v-else>
                  <button
                    v-for="item in comparisonRemovedPreview"
                    :key="item.snapshot_id"
                    type="button"
                    @click="openResultDetail(item.snapshot_id)"
                  >
                    {{ item.title }}
                  </button>
                </template>
              </section>
            </div>
          </template>
        </article>

        <article class="surface-card report-claims-card">
          <div class="page-heading">
            <div>
              <p class="panel-eyebrow">可引用结论</p>
              <h3>本周最值得复用的结论</h3>
            </div>
            <span class="secondary-text">{{ totalGroundedClaimCount }} 条</span>
          </div>

          <EmptyState
            v-if="reportGroundedItems.length === 0"
            title="暂无可引用结论"
            description="生成总结时提炼出的可引用结论会出现在这里。"
          />

          <div v-else class="report-claim-list">
            <button
              v-for="item in reportGroundedItems"
              :key="`${item.snapshot_id}-${item.claim}`"
              type="button"
              class="report-claim"
              @click="openResultDetail(item.snapshot_id)"
            >
              <strong>{{ item.title }}</strong>
              <span>{{ item.claim }}</span>
              <small>
                {{ item.evidence_titles.length ? `依据：${item.evidence_titles.join("、")}` : "暂无证据标题" }}
              </small>
            </button>
          </div>
        </article>

        <article class="surface-card report-items-card">
          <div class="page-heading">
            <div>
              <p class="panel-eyebrow">结果条目</p>
              <h3>本周报包含的结果条目</h3>
            </div>
            <span class="secondary-text">{{ reportItems.length }} 条</span>
          </div>

          <EmptyState
            v-if="reportItems.length === 0"
            title="没有返回结果条目"
            description="这个周报版本可以正常查看，但没有包含结果条目链接。"
          />

          <div v-else class="page-stack report-item-list">
            <article
              v-for="item in reportItems"
              :key="item.snapshot_id"
              class="surface-card surface-card--nested"
            >
              <div class="page-heading">
                <div>
                  <h3>{{ item.title }}</h3>
                  <p class="secondary-text">
                    {{ item.final_category || "待人工复核" }}
                    <span v-if="item.created_at"> · {{ formatDateTime(item.created_at) }}</span>
                  </p>
                </div>
                <el-button plain type="primary" @click="openResultDetail(item.snapshot_id)">
                  打开结果详情
                </el-button>
              </div>
              <div class="report-evidence-strip" aria-label="条目证据统计">
                <span>原文证据 {{ formatCount(item.evidence_citation_count) }}</span>
                <span>辅助摘要 {{ formatCount(item.memory_context_count) }}</span>
                <span>结论 {{ formatCount(item.grounded_claim_count) }}</span>
              </div>
              <p v-if="item.top_grounded_claims.length" class="report-item-claim">
                {{ item.top_grounded_claims[0] }}
              </p>
              <p v-if="item.top_evidence_titles.length" class="secondary-text report-evidence-titles">
                主要依据：{{ item.top_evidence_titles.join("、") }}
              </p>
              <p class="secondary-text">{{ item.snapshot_id }}</p>
            </article>
          </div>
        </article>
      </aside>
    </section>

    <EmptyState
      v-else
      title="周报内容不可用"
      :description="reportsStore.error ?? '请选择周次和版本，或重新生成新的周报。'"
    />
  </div>
</template>

<style scoped>
.report-page {
  gap: 14px;
}

.report-toolbar-panel {
  padding: 12px 14px;
}

.report-toolbar {
  align-items: center;
}

.report-workbench {
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 14px;
  align-items: start;
}

.report-document {
  min-height: calc(100vh - 158px);
}

.report-document > .page-heading {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}

.report-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.report-metric {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: #f7faf5;
}

.report-metric span {
  color: var(--ink-soft);
  font-size: 12px;
}

.report-metric strong {
  color: #17231d;
  font-size: 18px;
  line-height: 1.1;
}

.report-preview {
  margin-top: 12px;
  padding: 18px 20px;
  border-color: #dfe6dd;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(250, 251, 248, 0.96)),
    #ffffff;
  font-size: 14px;
  line-height: 1.78;
}

.report-preview :deep(h1),
.report-preview :deep(h2),
.report-preview :deep(h3) {
  margin-top: 1.2em;
  margin-bottom: 0.45em;
  color: #17231d;
}

.report-preview :deep(p),
.report-preview :deep(li) {
  color: #2d3831;
}

.report-preview :deep(code) {
  border-radius: 4px;
  padding: 1px 4px;
  background: #edf1eb;
}

.report-side {
  position: sticky;
  top: 82px;
  max-height: calc(100vh - 108px);
  overflow: auto;
  padding-right: 2px;
}

.report-chart-card,
.report-compare-card,
.report-claims-card,
.report-items-card {
  padding: 12px;
}

.report-source-summary {
  margin: 4px 0 10px;
  line-height: 1.5;
}

.report-chart-card .chart-stack {
  gap: 8px;
}

.report-chart-card :deep(.chart-surface) {
  height: 210px !important;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: #ffffff;
}

.report-compare-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  margin-top: 10px;
}

.report-compare-metrics span {
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid rgba(217, 130, 43, 0.22);
  border-radius: 6px;
  background: #fff8ef;
  color: #68400f;
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.report-compare-lists {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.report-compare-lists section {
  display: grid;
  gap: 6px;
}

.report-compare-lists h4 {
  margin: 0;
  color: #17231d;
  font-size: 13px;
}

.report-compare-lists button {
  width: 100%;
  padding: 8px 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #ffffff;
  color: #26322c;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.report-compare-lists button:hover,
.report-compare-lists button:focus-visible {
  border-color: rgba(31, 122, 90, 0.45);
  background: #f7fbf8;
}

.report-item-list {
  gap: 8px;
}

.report-item-list .surface-card--nested {
  padding: 11px;
  border-radius: var(--radius-panel);
  box-shadow: none;
}

.report-claim-list {
  display: grid;
  gap: 8px;
}

.report-claim {
  display: grid;
  gap: 5px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: #ffffff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.report-claim:hover,
.report-claim:focus-visible {
  border-color: rgba(31, 122, 90, 0.45);
  background: #f7fbf8;
}

.report-claim strong,
.report-claim span,
.report-claim small {
  min-width: 0;
  overflow-wrap: anywhere;
}

.report-claim span {
  line-height: 1.6;
}

.report-claim small {
  color: var(--ink-soft);
  line-height: 1.5;
}

.report-evidence-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.report-evidence-strip span {
  padding: 3px 7px;
  border: 1px solid rgba(31, 122, 90, 0.18);
  border-radius: 6px;
  background: #f0f7f2;
  color: #1e5f49;
  font-size: 12px;
  line-height: 1.4;
}

.report-item-claim {
  margin: 8px 0 0;
  color: #24332a;
  line-height: 1.65;
}

.report-evidence-titles {
  margin: 6px 0 0;
  line-height: 1.5;
}

@media (max-width: 960px) {
  .report-workbench {
    grid-template-columns: 1fr;
  }

  .report-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .report-side {
    position: static;
    max-height: none;
    overflow: visible;
  }
}
</style>
