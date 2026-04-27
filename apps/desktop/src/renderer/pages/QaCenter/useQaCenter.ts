import {
  computed,
  onMounted,
  reactive,
  shallowRef,
  type InjectionKey
} from "vue";

import { mapSourceTypeLabel } from "@/services/contract";
import { formatDateTime } from "@/services/format";
import { useConfigStore } from "@/stores/config";
import { useNoticesStore } from "@/stores/notices";
import { useQaStore } from "@/stores/qa";
import type { QAConversationMessage, QAMode } from "@/types";

type SidePanel = "filters" | "suggestions" | "diagnostics" | "sessions";
type EvidenceKind = "citations" | "grounded";
type FilterChipKey =
  | "source_type"
  | "knowledge_item_ids"
  | "keyword"
  | "category"
  | "user_tags"
  | "ai_tags";

interface FilterChip {
  key: FilterChipKey;
  label: string;
  value?: string;
}

const parseCsvList = (value: string) =>
  value
    .split(/[\n,，]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

export const useQaCenter = () => {
  const configStore = useConfigStore();
  const noticesStore = useNoticesStore();
  const qaStore = useQaStore();

  const question = shallowRef("");
  const currentMode = shallowRef<QAMode>("answer");
  const evidenceDrawerOpen = shallowRef(false);
  const evidenceDrawerKind = shallowRef<EvidenceKind>("citations");
  const evidenceMessageId = shallowRef<string | null>(null);
  const sideActivePanels = shallowRef<SidePanel[]>([
    "filters",
    "suggestions",
    "diagnostics",
    "sessions"
  ]);
  const filtersForm = reactive({
    source_types: [] as string[],
    knowledge_item_ids: "",
    keyword: "",
    category: "",
    user_tags: "",
    ai_tags: ""
  });

  const sourceTypeOptions = [
    { label: "网页链接", value: "url" },
    { label: "PDF 文件", value: "pdf" },
    { label: "Markdown 文档", value: "markdown" },
    { label: "纯文本", value: "text" }
  ];

  const modeOptions = [
    { label: "直接回答", value: "answer" },
    { label: "找知识点", value: "knowledge_point" },
    { label: "摘要视角", value: "summary" },
    { label: "原文视角", value: "source" }
  ];

  const evidenceKindOptions = [
    { label: "原文证据", value: "citations" },
    { label: "辅助摘要", value: "grounded" }
  ];

  const result = computed(() => qaStore.result);
  const sessions = computed(() => qaStore.sessions);
  const sessionDetail = computed(() => qaStore.sessionDetail);
  const generationReady = computed(() => configStore.generationReady);

  const chatMessages = computed<QAConversationMessage[]>(() => {
    if (sessionDetail.value?.messages?.length) {
      return sessionDetail.value.messages;
    }
    if (!result.value) {
      return [];
    }
    return [
      {
        message_id: `${result.value.session_id}-question`,
        role: "user",
        content: result.value.question,
        created_at: ""
      },
      {
        message_id: `${result.value.session_id}-answer`,
        role: "assistant",
        content: result.value.answer,
        created_at: "",
        question: result.value.question,
        rewritten_question: result.value.rewritten_question,
        rewrite: result.value.rewrite,
        answer_status: result.value.answer_status,
        confidence: result.value.confidence,
        applied_filters: result.value.applied_filters,
        citations: result.value.citations,
        used_grounded_items: result.value.used_grounded_items,
        suggested_queries: result.value.suggested_queries,
        verification: result.value.verification,
        retry_count: result.value.retry_count
      }
    ];
  });

  const traceSnapshot = computed(() => {
    if (!result.value) {
      return null;
    }
    return {
      question: result.value.question,
      rewrittenQuestion:
        result.value.rewrite?.rewritten_question ?? result.value.rewritten_question,
      usedHistory:
        result.value.rewrite?.used_history ??
        result.value.rewrite?.requires_history ??
        false,
      strategy: result.value.rewrite?.strategy ?? "unknown",
      intent: result.value.rewrite?.intent ?? "unknown",
      riskFlags: result.value.rewrite?.risk_flags ?? [],
      verificationStatus: result.value.verification?.status ?? "skipped",
      verificationReason: result.value.verification?.reason ?? "not_run",
      retryCount: result.value.retry_count ?? 0,
      citationIds: result.value.citations.map((citation) => citation.citation_id)
    };
  });

  const answerToneLabel = computed(() => {
    switch (result.value?.answer_status) {
      case "grounded":
        return "证据充分";
      case "needs_clarification":
        return "需要澄清";
      case "insufficient_evidence":
        return "证据不足";
      default:
        return "等待提问";
    }
  });

  const confidenceLabel = computed(() => {
    if (!result.value) {
      return "尚未生成";
    }
    return formatConfidence(result.value.confidence);
  });

  const modeLabel = computed(() => {
    switch (currentMode.value) {
      case "knowledge_point":
        return "找知识点";
      case "summary":
        return "摘要视角";
      case "source":
        return "原文视角";
      default:
        return "直接回答";
    }
  });

  const selectedEvidenceMessage = computed(() => {
    const selected = evidenceMessageId.value
      ? chatMessages.value.find((message) => message.message_id === evidenceMessageId.value)
      : null;
    if (selected) {
      return selected;
    }
    return [...chatMessages.value]
      .reverse()
      .find((message) => message.role === "assistant" && hasMessageEvidence(message)) ?? null;
  });

  const selectedCitations = computed(() => selectedEvidenceMessage.value?.citations ?? []);
  const selectedGroundedItems = computed(
    () => selectedEvidenceMessage.value?.used_grounded_items ?? []
  );
  const evidenceDrawerTitle = computed(() =>
    evidenceDrawerKind.value === "citations" ? "原文证据" : "辅助摘要证据"
  );

  const activeFilterChips = computed<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    for (const sourceType of filtersForm.source_types) {
      chips.push({
        key: "source_type",
        value: sourceType,
        label:
          sourceTypeOptions.find((option) => option.value === sourceType)?.label ??
          sourceType
      });
    }
    if (filtersForm.knowledge_item_ids.trim()) {
      chips.push({
        key: "knowledge_item_ids",
        label: `知识条目 ${parseCsvList(filtersForm.knowledge_item_ids).length} 个`
      });
    }
    if (filtersForm.keyword.trim()) {
      chips.push({ key: "keyword", label: `关键词 ${filtersForm.keyword.trim()}` });
    }
    if (filtersForm.category.trim()) {
      chips.push({ key: "category", label: `分类 ${filtersForm.category.trim()}` });
    }
    if (filtersForm.user_tags.trim()) {
      chips.push({
        key: "user_tags",
        label: `用户标签 ${parseCsvList(filtersForm.user_tags).length} 个`
      });
    }
    if (filtersForm.ai_tags.trim()) {
      chips.push({
        key: "ai_tags",
        label: `AI 标签 ${parseCsvList(filtersForm.ai_tags).length} 个`
      });
    }
    return chips;
  });

  const hasActiveFilters = computed(() => activeFilterChips.value.length > 0);

  const buildPayload = () => ({
    question: question.value.trim(),
    session_id: qaStore.selectedSessionId ?? undefined,
    mode: currentMode.value,
    filters: {
      source_types: filtersForm.source_types.length
        ? [...filtersForm.source_types]
        : undefined,
      knowledge_item_ids: parseCsvList(filtersForm.knowledge_item_ids),
      keyword: filtersForm.keyword.trim() || undefined,
      category: filtersForm.category.trim() || undefined,
      user_tags: parseCsvList(filtersForm.user_tags),
      ai_tags: parseCsvList(filtersForm.ai_tags)
    }
  });

  const submitQuestion = async () => {
    if (!question.value.trim()) {
      noticesStore.push({
        kind: "warning",
        title: "问题为空",
        message: "请先输入一个具体问题。"
      });
      return;
    }

    try {
      const response = await qaStore.answer(buildPayload());
      question.value = "";
      await qaStore.loadSessions();
      await qaStore.loadSession(response.session_id);
    } catch {
      noticesStore.push({
        kind: "warning",
        title: "问答请求失败",
        message: qaStore.error ?? "问答接口请求失败。"
      });
    }
  };

  const applySuggestedQuery = async (value: string) => {
    question.value = value;
    await submitQuestion();
  };

  const startNewSession = () => {
    question.value = "";
    qaStore.reset();
  };

  const clearAllFilters = () => {
    filtersForm.source_types = [];
    filtersForm.knowledge_item_ids = "";
    filtersForm.keyword = "";
    filtersForm.category = "";
    filtersForm.user_tags = "";
    filtersForm.ai_tags = "";
  };

  const clearFilterChip = (key: FilterChipKey, value?: string) => {
    if (key === "source_type" && value) {
      filtersForm.source_types = filtersForm.source_types.filter((entry) => entry !== value);
      return;
    }

    switch (key) {
      case "knowledge_item_ids":
        filtersForm.knowledge_item_ids = "";
        break;
      case "keyword":
        filtersForm.keyword = "";
        break;
      case "category":
        filtersForm.category = "";
        break;
      case "user_tags":
        filtersForm.user_tags = "";
        break;
      case "ai_tags":
        filtersForm.ai_tags = "";
        break;
      default:
        filtersForm.source_types = [];
    }
  };

  const openEvidenceDrawer = (message: QAConversationMessage, kind: EvidenceKind) => {
    evidenceMessageId.value = message.message_id;
    evidenceDrawerKind.value = kind;
    evidenceDrawerOpen.value = true;
  };

  const closeEvidenceDrawer = () => {
    evidenceDrawerOpen.value = false;
  };

  const openSession = async (sessionId: string) => {
    try {
      const detail = await qaStore.loadSession(sessionId);
      currentMode.value = detail.mode;
      question.value = "";
      await qaStore.loadSessions();
    } catch {
      noticesStore.push({
        kind: "warning",
        title: "加载会话失败",
        message: qaStore.error ?? "读取问答会话失败。"
      });
    }
  };

  onMounted(() => {
    void configStore.load();
    void qaStore.loadSessions();
  });

  return reactive({
    question,
    currentMode,
    evidenceDrawerOpen,
    evidenceDrawerKind,
    evidenceMessageId,
    sideActivePanels,
    filtersForm,
    sourceTypeOptions,
    modeOptions,
    evidenceKindOptions,
    configStore,
    qaStore,
    result,
    sessions,
    sessionDetail,
    generationReady,
    chatMessages,
    traceSnapshot,
    answerToneLabel,
    confidenceLabel,
    modeLabel,
    selectedEvidenceMessage,
    selectedCitations,
    selectedGroundedItems,
    evidenceDrawerTitle,
    activeFilterChips,
    hasActiveFilters,
    submitQuestion,
    applySuggestedQuery,
    startNewSession,
    clearAllFilters,
    clearFilterChip,
    openEvidenceDrawer,
    closeEvidenceDrawer,
    hasMessageEvidence,
    answerStatusLabel,
    formatConfidence,
    openSession,
    formatDateTime,
    mapSourceTypeLabel
  });
};

export type QaCenterContext = ReturnType<typeof useQaCenter>;
export const qaCenterKey: InjectionKey<QaCenterContext> = Symbol("qa-center");

function hasMessageEvidence(message: QAConversationMessage) {
  return (
    (message.citations?.length ?? 0) > 0 ||
    (message.used_grounded_items?.length ?? 0) > 0
  );
}

function answerStatusLabel(status?: QAConversationMessage["answer_status"]) {
  switch (status) {
    case "grounded":
      return "证据充分";
    case "needs_clarification":
      return "需要澄清";
    case "insufficient_evidence":
      return "证据不足";
    default:
      return "等待提问";
  }
}

function formatConfidence(value?: number | null) {
  if (typeof value !== "number") {
    return "尚未生成";
  }
  return `${Math.round(value * 100)}%`;
}
