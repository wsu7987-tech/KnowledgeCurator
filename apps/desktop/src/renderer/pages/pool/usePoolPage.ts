import {
  computed,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
  type InjectionKey
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import MarkdownIt from "markdown-it";

import type { PoolEntryFormExpose } from "./pool-entry-form";
import {
  mapPdfParserLabel,
  resolvePdfPreviewContent
} from "@/services/pdfDraftPresentation";
import {
  mapWebParserLabel,
  resolveWebPreviewContent
} from "@/services/webDraftPresentation";
import { api } from "@/services/api";
import { formatDateTime } from "@/services/format";
import {
  deriveSourceLabel,
  mapErrorCategoryLabel,
  mapSourceTypeLabel
} from "@/services/contract";
import { useConfigStore } from "@/stores/config";
import { useNoticesStore } from "@/stores/notices";
import { usePdfDraftStore } from "@/stores/pdfDraft";
import { usePoolStore } from "@/stores/pool";
import { useWebDraftStore } from "@/stores/webDraft";
import type { PdfReparseJob, WebReparseJob } from "@/types";

export type PoolSourceType = "url" | "pdf" | "markdown" | "text";
export type DraftTaskSourceType = "url" | "pdf";

export interface UnifiedDraftTaskCard {
  id: string;
  draftId: string;
  jobId?: string;
  sourceType: DraftTaskSourceType;
  sourceLabel: string;
  title: string;
  source: string;
  status: string;
  statusLabel: string;
  parserLabel: string;
  progressLabel: string;
  updatedAt: string;
  isActive: boolean;
  job: PdfReparseJob | WebReparseJob | null;
}

type UrlFormExpose = PoolEntryFormExpose & {
  selectSessionProfile?: (profileId: string | null) => void;
};

const validPoolStatuses = new Set([
  "all",
  "pending",
  "running",
  "succeeded",
  "failed"
]);

export const usePoolPage = () => {
  const route = useRoute();
  const router = useRouter();
  const poolStore = usePoolStore();
  const pdfDraftStore = usePdfDraftStore();
  const webDraftStore = useWebDraftStore();
  const noticesStore = useNoticesStore();
  const configStore = useConfigStore();
  const markdown = new MarkdownIt({ breaks: true, linkify: true });

  const activeSourceType = shallowRef<PoolSourceType>("url");
  const previewViewMode = shallowRef<"preview" | "full">("preview");
  const pdfPreviewCleaningMode = shallowRef<"basic" | "enhanced">("basic");
  const webPreviewCleaningMode = shallowRef<"basic" | "enhanced">("basic");
  const sessionManagerOpen = shallowRef(false);
  const poolItemsCurrentPage = shallowRef(1);
  const poolItemsPageSize = shallowRef(10);
  const poolItemsTableMaxHeight = shallowRef(420);
  const draftTaskTableMaxHeight = shallowRef(360);
  const urlFormRef = ref<UrlFormExpose | null>(null);
  const pdfFormRef = ref<PoolEntryFormExpose | null>(null);
  const markdownFormRef = ref<PoolEntryFormExpose | null>(null);
  const textFormRef = ref<PoolEntryFormExpose | null>(null);
  const pdfDraftMetadataById = ref<
    Record<string, { category: string; tags: string[] }>
  >({});
  const webDraftMetadataById = ref<
    Record<string, { category: string; tags: string[] }>
  >({});
  const suggestingPdfMetadata = shallowRef(false);
  const suggestingWebMetadata = shallowRef(false);

  const sourceOptions = [
    { label: "网页链接", value: "url" },
    { label: "PDF 文件", value: "pdf" },
    { label: "Markdown 文档", value: "markdown" },
    { label: "纯文本", value: "text" }
  ];

  const parserOptions = [
    { label: "自动判断", value: "auto" },
    { label: "PyMuPDF Markdown", value: "pymupdf4llm_markdown" },
    { label: "RapidOCR", value: "rapid_ocr" }
  ];

  const quickCaptureMode = computed(() => route.query.mode === "quick-capture");
  const activeEntryForm = computed(() => {
    switch (activeSourceType.value) {
      case "pdf":
        return pdfFormRef.value;
      case "markdown":
        return markdownFormRef.value;
      case "text":
        return textFormRef.value;
      case "url":
      default:
        return urlFormRef.value;
    }
  });
  const primaryActionLabel = computed(() =>
    activeSourceType.value === "url" || activeSourceType.value === "pdf"
      ? "解析并预览"
      : "加入总结池"
  );
  const primaryActionLoading = computed(() => {
    if (activeSourceType.value === "url") {
      return webDraftStore.creating;
    }
    if (activeSourceType.value === "pdf") {
      return pdfDraftStore.creating;
    }
    return poolStore.submitting;
  });
  const showWebTaskCards = computed(() => webDraftStore.taskCards.length > 0);
  const showPdfTaskCards = computed(() => pdfDraftStore.taskCards.length > 0);
  const unifiedDraftTaskCards = computed<UnifiedDraftTaskCard[]>(() =>
    [
      ...webDraftStore.taskCards.map((card) => ({
        id: `url:${card.draft.id}`,
        draftId: card.draft.id,
        jobId: card.job?.id,
        sourceType: "url" as const,
        sourceLabel: "网页",
        title: card.draft.title || card.draft.source_name,
        source: card.draft.url,
        status: card.status,
        statusLabel: mapWebTaskStatusLabel(card.status),
        parserLabel: mapWebParserLabel(card.parserName),
        progressLabel: card.progressLabel,
        updatedAt: card.updatedAt,
        isActive: card.draft.id === webDraftStore.activeDraftId,
        job: card.job
      })),
      ...pdfDraftStore.taskCards.map((card) => ({
        id: `pdf:${card.draft.id}`,
        draftId: card.draft.id,
        jobId: card.job?.id,
        sourceType: "pdf" as const,
        sourceLabel: "PDF",
        title: card.draft.title || card.draft.source_name,
        source: card.draft.source_name,
        status: card.status,
        statusLabel: mapPdfTaskStatusLabel(card.status),
        parserLabel: mapPdfParserLabel(card.parserName),
        progressLabel: card.progressLabel,
        updatedAt: card.updatedAt,
        isActive: card.draft.id === pdfDraftStore.activeDraftId,
        job: card.job
      }))
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  );
  const showDraftTaskList = computed(() => unifiedDraftTaskCards.value.length > 0);
  const visibleItems = computed(() => poolStore.filteredItems);
  const pagedPoolItems = computed(() => {
    const start = (poolItemsCurrentPage.value - 1) * poolItemsPageSize.value;
    return visibleItems.value.slice(start, start + poolItemsPageSize.value);
  });
  const showConnectionError = computed(
    () =>
      poolStore.hasLoaded &&
      poolStore.connectionUnavailable &&
      poolStore.items.length === 0
  );
  const showPoolEmpty = computed(
    () =>
      poolStore.hasLoaded &&
      !poolStore.connectionUnavailable &&
      poolStore.items.length === 0
  );
  const showFilteredEmpty = computed(
    () =>
      poolStore.hasLoaded &&
      !poolStore.connectionUnavailable &&
      poolStore.items.length > 0 &&
      visibleItems.value.length === 0
  );

  const previewContent = computed(() =>
    resolvePdfPreviewContent({
      activePreviewResult: pdfDraftStore.activePreviewResult,
      viewMode: previewViewMode.value,
      cleaningMode: pdfPreviewCleaningMode.value
    })
  );
  const renderedPreviewHtml = computed(() =>
    previewContent.value.mode === "markdown"
      ? markdown.render(previewContent.value.content)
      : ""
  );
  const webPreviewContent = computed(() =>
    resolveWebPreviewContent({
      activePreviewResult: webDraftStore.activePreviewResult,
      viewMode: previewViewMode.value,
      cleaningMode: webPreviewCleaningMode.value
    })
  );
  const renderedWebPreviewHtml = computed(() =>
    webPreviewContent.value.mode === "markdown"
      ? markdown.render(webPreviewContent.value.content)
      : ""
  );

  const draftPreviewHeading = computed(() =>
    pdfDraftStore.hasUnsavedPreview ? "当前临时解析结果" : "当前已保存版本"
  );
  const draftPreviewNotice = computed(() =>
    pdfDraftStore.hasUnsavedPreview
      ? "当前为临时解析结果，未保存前不会生效，加入总结池仍然使用已保存版本。"
      : "当前预览就是已保存版本，加入总结池会使用它。"
  );
  const webDraftPreviewHeading = computed(() =>
    webDraftStore.hasUnsavedPreview ? "当前临时抓取结果" : "当前已保存版本"
  );
  const webDraftPreviewNotice = computed(() =>
    webDraftStore.hasUnsavedPreview
      ? "当前为临时抓取结果，未保存前不会生效，加入总结池仍然使用已保存版本。"
      : "当前预览就是已保存版本，加入总结池会使用它。"
  );
  const savedVersionNote = computed(() => {
    if (!pdfDraftStore.savedParseResult) {
      return "还没有可用的保存版本。";
    }
    return `当前保存方案：${mapPdfParserLabel(
      pdfDraftStore.savedParseResult.parser_name
    )}`;
  });
  const savedWebVersionNote = computed(() => {
    if (!webDraftStore.savedParseResult) {
      return "还没有可用的保存版本。";
    }
    return `当前保存方案：${mapWebParserLabel(
      webDraftStore.savedParseResult.parser_name
    )}`;
  });
  const pdfCleaningStatus = computed(() =>
    pdfPreviewCleaningMode.value === "enhanced"
      ? {
          label: "当前展示：增强清洗版",
          detail: "会进一步去掉导航、版权和明显模板噪声；点“还原”可回到基础清洗版。"
        }
      : {
          label: "当前展示：基础清洗版",
          detail: "默认只做页码、版权等基础清理；点“增强清洗”可查看更多去噪结果。"
        }
  );
  const webCleaningStatus = computed(() =>
    webPreviewCleaningMode.value === "enhanced"
      ? {
          label: "当前展示：增强清洗版",
          detail: "会进一步去掉导航、版权和明显模板噪声；点“还原”可回到基础清洗版。"
        }
      : {
          label: "当前展示：基础清洗版",
          detail: "默认只做页码、版权等基础清理；点“增强清洗”可查看更多去噪结果。"
        }
  );

  const activePdfDraftMetadata = computed({
    get: () => {
      const draftId = pdfDraftStore.draft?.id;
      if (!draftId) {
        return { category: "", tags: [] as string[] };
      }
      return pdfDraftMetadataById.value[draftId] ?? { category: "", tags: [] };
    },
    set: (value: { category: string; tags: string[] }) => {
      const draftId = pdfDraftStore.draft?.id;
      if (!draftId) {
        return;
      }
      pdfDraftMetadataById.value = {
        ...pdfDraftMetadataById.value,
        [draftId]: { category: value.category, tags: [...value.tags] }
      };
    }
  });
  const activeWebDraftMetadata = computed({
    get: () => {
      const draftId = webDraftStore.draft?.id;
      if (!draftId) {
        return { category: "", tags: [] as string[] };
      }
      return webDraftMetadataById.value[draftId] ?? { category: "", tags: [] };
    },
    set: (value: { category: string; tags: string[] }) => {
      const draftId = webDraftStore.draft?.id;
      if (!draftId) {
        return;
      }
      webDraftMetadataById.value = {
        ...webDraftMetadataById.value,
        [draftId]: { category: value.category, tags: [...value.tags] }
      };
    }
  });

  const setUrlFormRef = (value: unknown) => {
    urlFormRef.value = value as UrlFormExpose | null;
  };
  const setPdfFormRef = (value: unknown) => {
    pdfFormRef.value = value as PoolEntryFormExpose | null;
  };
  const setMarkdownFormRef = (value: unknown) => {
    markdownFormRef.value = value as PoolEntryFormExpose | null;
  };
  const setTextFormRef = (value: unknown) => {
    textFormRef.value = value as PoolEntryFormExpose | null;
  };
  const selectSessionProfile = (profileId: string | null) => {
    urlFormRef.value?.selectSessionProfile?.(profileId);
  };

  const mapPdfTaskStatusLabel = (status: string) =>
    ({
      queued: "排队中",
      running: "解析中",
      completed: "已完成",
      preview: "未保存",
      ready: "已就绪",
      failed: "失败",
      cancelled: "已取消"
    })[status] ?? status;
  const mapWebTaskStatusLabel = (status: string) =>
    ({
      queued: "排队中",
      running: "抓取中",
      completed: "已完成",
      preview: "未保存",
      ready: "已就绪",
      failed: "失败",
      cancelled: "已取消"
    })[status] ?? status;
  const mapTaskTagType = (status: string) => {
    if (status === "queued" || status === "running") {
      return "warning";
    }
    if (status === "ready") {
      return "success";
    }
    if (status === "failed") {
      return "danger";
    }
    return "info";
  };
  const mapCleaningLevelLabel = (cleaningLevel?: string | null) =>
    cleaningLevel === "enhanced"
      ? "增强清洗"
      : cleaningLevel === "basic"
        ? "基础清洗"
        : "未标记";
  const getPdfJobProgress = (processedPages: number, totalPages: number) =>
    totalPages <= 0 ? 0 : Math.round((processedPages / totalPages) * 100);
  const formatPdfJobProgress = (processedPages: number, totalPages: number) =>
    totalPages <= 0
      ? `${processedPages} / ? 页`
      : `${processedPages} / ${totalPages} 页`;

  const confirmDangerAction = async (message: string, title: string) => {
    try {
      await ElMessageBox.confirm(message, title, {
        confirmButtonText: "确认",
        cancelButtonText: "取消",
        type: "warning",
        confirmButtonClass: "el-button--danger"
      });
      return true;
    } catch {
      return false;
    }
  };

  const pushQuickCaptureModeGuardNotice = (target: string) => {
    noticesStore.push({
      kind: "info",
      title: "请先退出快速集采模式",
      message: `快速集采模式下不打开${target}，请先点击“退出”后继续。`
    });
  };
  const submitActiveEntry = async () => {
    const succeeded = await activeEntryForm.value?.submit();
    if (
      succeeded &&
      quickCaptureMode.value &&
      (activeSourceType.value === "url" || activeSourceType.value === "pdf")
    ) {
      pushQuickCaptureModeGuardNotice("预览详情");
    }
  };
  const toggleQuickCaptureMode = async () => {
    await router.push({
      name: "pool",
      query: quickCaptureMode.value ? undefined : { mode: "quick-capture" }
    });
  };

  const refreshPoolItems = async () => {
    await poolStore.fetchItems();
  };
  const viewItem = async (item: { result_snapshot_id?: string | null }) => {
    if (!item.result_snapshot_id) {
      noticesStore.push({
        kind: "info",
        title: "暂无总结详情",
        message: "该条目还没有生成结果快照。"
      });
      return;
    }
    await router.push({ name: "item-detail", params: { snapshotId: item.result_snapshot_id } });
  };
  const deleteItem = async (itemId: string) => {
    if (!(await confirmDangerAction("删除后不会再进入后续总结流程。", "删除条目？"))) {
      return;
    }
    await poolStore.removeItem(itemId);
  };
  const reingestItem = async (itemId: string) => {
    await poolStore.reingestItem(itemId);
  };
  const resummarizeItem = async (itemId: string) => {
    await poolStore.resummarizeItem(itemId);
  };

  const reopenPdfDraftDrawer = async (draftId?: string, jobId?: string) => {
    if (quickCaptureMode.value) {
      pushQuickCaptureModeGuardNotice("预览详情");
      return;
    }
    try {
      if (draftId) {
        await pdfDraftStore.openTask(draftId, jobId);
      } else {
        pdfDraftStore.reopenDrawer();
      }
    } catch {
      noticesStore.push({
        kind: "error",
        title: "加载解析结果失败",
        message: pdfDraftStore.error ?? "请稍后再试。"
      });
    }
  };
  const reopenWebDraftDrawer = async (draftId?: string, jobId?: string) => {
    if (quickCaptureMode.value) {
      pushQuickCaptureModeGuardNotice("预览详情");
      return;
    }
    try {
      if (draftId) {
        await webDraftStore.openTask(draftId, jobId);
      } else {
        webDraftStore.reopenDrawer();
      }
    } catch {
      noticesStore.push({
        kind: "error",
        title: "加载抓取结果失败",
        message: webDraftStore.error ?? "请稍后再试。"
      });
    }
  };
  const openDraftTaskDetail = async (task: UnifiedDraftTaskCard) => {
    if (task.sourceType === "pdf") {
      await reopenPdfDraftDrawer(task.draftId, task.jobId);
      return;
    }
    await reopenWebDraftDrawer(task.draftId, task.jobId);
  };
  const removePdfDraft = async (draftId: string) => {
    if (!(await confirmDangerAction("删除后需要重新选择 PDF 并解析才能恢复这个草稿。", "删除 PDF 任务？"))) {
      return;
    }
    await pdfDraftStore.openTask(draftId);
    await pdfDraftStore.discardDraft();
  };
  const removeWebDraft = async (draftId: string) => {
    if (!(await confirmDangerAction("删除后需要重新抓取网页才能恢复这个草稿。", "删除网页任务？"))) {
      return;
    }
    await webDraftStore.openTask(draftId);
    await webDraftStore.discardDraft();
  };
  const removeDraftTask = async (task: UnifiedDraftTaskCard) => {
    if (task.sourceType === "pdf") {
      await removePdfDraft(task.draftId);
      return;
    }
    await removeWebDraft(task.draftId);
  };

  const reparsePdfDraft = async () => {
    await pdfDraftStore.reparseDraft();
  };
  const saveCurrentPdfResult = async () => {
    await pdfDraftStore.saveCurrentResult();
  };
  const savePdfResultToLocal = async () => {
    await pdfDraftStore.saveActiveResultToLocal();
  };
  const reparseWebDraft = async () => {
    await webDraftStore.reparseDraft();
  };
  const saveCurrentWebResult = async () => {
    await webDraftStore.saveCurrentResult();
  };
  const saveWebResultToLocal = async () => {
    await webDraftStore.saveActiveResultToLocal();
  };

  const buildPdfCommitPayload = () => ({
    ...activePdfDraftMetadata.value,
    cleaned_text: resolvePdfPreviewContent({
      activePreviewResult: pdfDraftStore.activePreviewResult,
      viewMode: "full",
      cleaningMode: pdfPreviewCleaningMode.value
    }).content,
    cleaning_level: pdfPreviewCleaningMode.value
  });
  const buildWebCommitPayload = () => ({
    ...activeWebDraftMetadata.value,
    cleaned_text: resolveWebPreviewContent({
      activePreviewResult: webDraftStore.activePreviewResult,
      viewMode: "full",
      cleaningMode: webPreviewCleaningMode.value
    }).content,
    cleaning_level: webPreviewCleaningMode.value
  });
  const commitPdfDraft = async () => {
    const item = await pdfDraftStore.commitDraft(buildPdfCommitPayload());
    if (item) {
      await poolStore.fetchItems();
    }
  };
  const commitWebDraft = async () => {
    const item = await webDraftStore.commitDraft(buildWebCommitPayload());
    if (item) {
      await poolStore.fetchItems();
    }
  };
  const closePdfDraftDrawer = () => pdfDraftStore.closeDrawer();
  const closeWebDraftDrawer = () => webDraftStore.closeDrawer();
  const handlePdfDraftBeforeClose = (done: () => void) => {
    closePdfDraftDrawer();
    done();
  };
  const handleWebDraftBeforeClose = (done: () => void) => {
    closeWebDraftDrawer();
    done();
  };

  const suggestPdfDraftMetadata = async () => {
    suggestingPdfMetadata.value = true;
    try {
      const suggestion = await api.suggestPoolMetadata({
        source_type: "pdf",
        source_value: pdfDraftStore.draft?.source_name ?? "pdf-draft",
        title: pdfDraftStore.draft?.title ?? pdfDraftStore.draft?.source_name ?? null,
        raw_text: previewContent.value.content
      });
      activePdfDraftMetadata.value = {
        category: suggestion.category,
        tags: suggestion.tags
      };
    } finally {
      suggestingPdfMetadata.value = false;
    }
  };
  const suggestWebDraftMetadata = async () => {
    suggestingWebMetadata.value = true;
    try {
      const suggestion = await api.suggestPoolMetadata({
        source_type: "url",
        source_value: webDraftStore.draft?.url ?? "web-draft",
        title: webDraftStore.draft?.title ?? webDraftStore.draft?.source_name ?? null,
        raw_text: webPreviewContent.value.content
      });
      activeWebDraftMetadata.value = {
        category: suggestion.category,
        tags: suggestion.tags
      };
    } finally {
      suggestingWebMetadata.value = false;
    }
  };

  watch(
    () => activeSourceType.value,
    async (nextType) => {
      if (nextType === "url") {
        await webDraftStore.refreshJobs().catch(() => undefined);
      }
      if (nextType === "pdf") {
        await pdfDraftStore.refreshJobs().catch(() => undefined);
      }
    }
  );
  watch(
    () => [visibleItems.value.length, poolItemsPageSize.value] as const,
    ([total, size]) => {
      const maxPage = Math.max(1, Math.ceil(total / size));
      if (poolItemsCurrentPage.value > maxPage) {
        poolItemsCurrentPage.value = maxPage;
      }
    }
  );
  watch(
    () => [poolStore.filters.status, poolStore.filters.query] as const,
    () => {
      poolItemsCurrentPage.value = 1;
    }
  );
  watch(
    () => [pdfDraftStore.drawerOpen, pdfDraftStore.activePreviewResult?.id] as const,
    ([drawerOpen, parseResultId]) => {
      if (drawerOpen && parseResultId) {
        previewViewMode.value = "preview";
        pdfPreviewCleaningMode.value = "basic";
      }
    },
    { immediate: true }
  );
  watch(
    () => [webDraftStore.drawerOpen, webDraftStore.activePreviewResult?.id] as const,
    ([drawerOpen, parseResultId]) => {
      if (drawerOpen && parseResultId) {
        previewViewMode.value = "preview";
        webPreviewCleaningMode.value = "basic";
      }
    },
    { immediate: true }
  );
  watch(quickCaptureMode, (enabled) => {
    if (enabled) {
      pdfDraftStore.closeDrawer();
      webDraftStore.closeDrawer();
    }
  });
  watch(
    () => ({ ...poolStore.filters }),
    (filters) => {
      void router.replace({
        query: {
          ...route.query,
          q: filters.query.trim() || undefined,
          status: filters.status === "all" ? undefined : filters.status
        }
      });
    },
    { deep: true }
  );

  onMounted(async () => {
    const status = String(route.query.status ?? "pending");
    poolStore.filters.status = validPoolStatuses.has(status) ? status : "pending";
    poolStore.filters.query = String(route.query.q ?? "");
    await Promise.allSettled([
      configStore.load(),
      poolStore.fetchItems(),
      pdfDraftStore.refreshJobs(),
      webDraftStore.refreshJobs()
    ]);
  });

  return reactive({
    activeSourceType,
    sourceOptions,
    parserOptions,
    previewViewMode,
    pdfPreviewCleaningMode,
    webPreviewCleaningMode,
    sessionManagerOpen,
    poolItemsCurrentPage,
    poolItemsPageSize,
    poolItemsTableMaxHeight,
    draftTaskTableMaxHeight,
    poolStore,
    pdfDraftStore,
    webDraftStore,
    quickCaptureMode,
    primaryActionLabel,
    primaryActionLoading,
    showWebTaskCards,
    showPdfTaskCards,
    showDraftTaskList,
    unifiedDraftTaskCards,
    visibleItems,
    pagedPoolItems,
    showConnectionError,
    showPoolEmpty,
    showFilteredEmpty,
    previewContent,
    renderedPreviewHtml,
    webPreviewContent,
    renderedWebPreviewHtml,
    draftPreviewHeading,
    draftPreviewNotice,
    webDraftPreviewHeading,
    webDraftPreviewNotice,
    savedVersionNote,
    savedWebVersionNote,
    pdfCleaningStatus,
    webCleaningStatus,
    activePdfDraftMetadata,
    activeWebDraftMetadata,
    suggestingPdfMetadata,
    suggestingWebMetadata,
    setUrlFormRef,
    setPdfFormRef,
    setMarkdownFormRef,
    setTextFormRef,
    selectSessionProfile,
    submitActiveEntry,
    toggleQuickCaptureMode,
    refreshPoolItems,
    viewItem,
    deleteItem,
    reingestItem,
    resummarizeItem,
    reopenPdfDraftDrawer,
    reopenWebDraftDrawer,
    openDraftTaskDetail,
    removePdfDraft,
    removeWebDraft,
    removeDraftTask,
    reparsePdfDraft,
    saveCurrentPdfResult,
    savePdfResultToLocal,
    reparseWebDraft,
    saveCurrentWebResult,
    saveWebResultToLocal,
    commitPdfDraft,
    commitWebDraft,
    closePdfDraftDrawer,
    closeWebDraftDrawer,
    handlePdfDraftBeforeClose,
    handleWebDraftBeforeClose,
    suggestPdfDraftMetadata,
    suggestWebDraftMetadata,
    deriveSourceLabel,
    mapErrorCategoryLabel,
    mapSourceTypeLabel,
    mapPdfParserLabel,
    mapWebParserLabel,
    mapPdfTaskStatusLabel,
    mapWebTaskStatusLabel,
    mapTaskTagType,
    mapCleaningLevelLabel,
    getPdfJobProgress,
    formatPdfJobProgress,
    formatDateTime
  });
};

export type PoolPageContext = ReturnType<typeof usePoolPage>;
export const poolPageKey: InjectionKey<PoolPageContext> = Symbol("pool-page");
