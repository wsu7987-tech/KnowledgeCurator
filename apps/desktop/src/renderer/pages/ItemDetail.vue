<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch, type ComponentPublicInstance } from "vue";
import MarkdownIt from "markdown-it";
import { useRoute, useRouter } from "vue-router";

import EmptyState from "@/components/EmptyState.vue";
import EndpointNotice from "@/components/EndpointNotice.vue";
import { ApiError, NetworkError, api } from "@/services/api";
import { openPath, saveTextFile } from "@/services/desktop-bridge";
import { formatDateTime } from "@/services/format";
import { useNoticesStore } from "@/stores/notices";
import type { ResultDetail } from "@/types";

const route = useRoute();
const router = useRouter();
const noticesStore = useNoticesStore();
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
});

const detail = ref<ResultDetail | null>(null);
const activeParseResult = ref<Record<string, unknown> | null>(null);
const originalFocus = ref<{ label: string; snippet: string } | null>(null);
const focusedOriginalBlockIndex = ref<number | null>(null);
const originalBlockRefs = ref<Record<number, HTMLElement | null>>({});
const readerVisible = ref(false);
const readerContentRef = ref<HTMLElement | null>(null);
const focusedReaderElement = ref<HTMLElement | null>(null);
const loading = ref(false);
const saving = ref(false);
const editMode = ref(false);
const feedbackLoading = ref<"useful" | "useless" | null>(null);
const endpointUnavailable = ref(false);
const connectionUnavailable = ref(false);
const error = ref<string | null>(null);
const newTag = ref("");
const form = reactive({
  final_category: "",
  final_tags: ""
});

interface RelatedItemCard {
  snapshotId: string;
  title: string;
  finalCategory: string | null;
  sourceType: string | null;
  createdAt: string | null;
  relationReason: string | null;
}

const snapshotId = computed(() => String(route.params.snapshotId ?? ""));
const missingSnapshotId = computed(() => snapshotId.value.length === 0);
const detailRecord = computed<Record<string, unknown> | null>(() =>
  detail.value ? (detail.value as Record<string, unknown>) : null
);

const stringifyMetaValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringifyMetaValue(item)).filter(Boolean).join("，");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

const parseMetaEntries = (value: unknown): Array<{ key: string; value: string }> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value)
    .map(([key, rawValue]) => ({
      key,
      value: stringifyMetaValue(rawValue)
    }))
    .filter((entry) => entry.value.length > 0);
};

const parseRelatedItems = (value: unknown): RelatedItemCard[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return [
        {
          snapshotId: entry,
          title: entry,
          finalCategory: null,
          sourceType: null,
          createdAt: null,
          relationReason: null
        }
      ];
    }

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const snapshotIdValue =
      typeof record.snapshot_id === "string"
        ? record.snapshot_id
        : typeof record.snapshotId === "string"
          ? record.snapshotId
          : "";

    if (!snapshotIdValue) {
      return [];
    }

    return [
      {
        snapshotId: snapshotIdValue,
        title:
          typeof record.title === "string" && record.title.trim().length > 0
            ? record.title
            : snapshotIdValue,
        finalCategory:
          typeof record.final_category === "string" && record.final_category.trim().length > 0
            ? record.final_category
            : typeof record.finalCategory === "string" && record.finalCategory.trim().length > 0
              ? record.finalCategory
              : null,
        sourceType:
          typeof record.source_type === "string" && record.source_type.trim().length > 0
            ? record.source_type
            : typeof record.sourceType === "string" && record.sourceType.trim().length > 0
              ? record.sourceType
              : null,
        createdAt:
          typeof record.created_at === "string" && record.created_at.trim().length > 0
            ? record.created_at
            : typeof record.createdAt === "string" && record.createdAt.trim().length > 0
              ? record.createdAt
              : null,
        relationReason:
          typeof record.relation_reason === "string" && record.relation_reason.trim().length > 0
            ? record.relation_reason
            : typeof record.relationReason === "string" && record.relationReason.trim().length > 0
              ? record.relationReason
              : null
      }
    ];
  });
};

const relatedItems = computed(() =>
  parseRelatedItems(detailRecord.value?.related_items ?? detailRecord.value?.relatedItems)
);
const summaryMetaEntries = computed(() =>
  parseMetaEntries(
    detailRecord.value?.summary_meta ??
      detailRecord.value?.summaryMetadata ??
      detailRecord.value?.summary_metadata
  )
);
const relationMetaEntries = computed(() =>
  parseMetaEntries(detailRecord.value?.relation_meta ?? detailRecord.value?.relationMeta)
);
const renderedMarkdown = computed(() =>
  detail.value?.markdown_content ? md.render(detail.value.markdown_content) : ""
);
const parseResultRecord = computed<Record<string, unknown> | null>(() =>
  activeParseResult.value ? (activeParseResult.value as Record<string, unknown>) : null
);
const originalMarkdownContent = computed(() => {
  const markdownText = parseResultRecord.value?.markdown_text;
  if (typeof markdownText === "string" && markdownText.trim().length > 0) {
    return markdownText;
  }
  const canonical = parseResultRecord.value?.canonical_content;
  if (typeof canonical === "string" && canonical.trim().length > 0) {
    return canonical;
  }
  return "";
});
const originalPlainText = computed(() => {
  const rawText = parseResultRecord.value?.raw_text;
  if (typeof rawText === "string" && rawText.trim().length > 0) {
    return rawText;
  }
  const canonical = parseResultRecord.value?.canonical_content;
  if (typeof canonical === "string") {
    return canonical;
  }
  return "";
});
const normalizeForMatch = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
const originalBlocks = computed(() => {
  const source = originalPlainText.value || originalMarkdownContent.value;
  if (!source.trim()) {
    return [];
  }
  return source
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
});
const renderedOriginalMarkdown = computed(() =>
  originalMarkdownContent.value ? md.render(originalMarkdownContent.value) : ""
);
const hasOriginalReaderContent = computed(
  () => originalBlocks.value.length > 0 || Boolean(renderedOriginalMarkdown.value) || Boolean(originalPlainText.value)
);
const evidenceCitations = computed(() => {
  const raw = detailRecord.value?.evidence_bundle;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const citations = (raw as Record<string, unknown>).citations;
  if (!Array.isArray(citations)) {
    return [];
  }
  return citations.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const citationId = typeof record.citation_id === "string" ? record.citation_id : "";
    const title = typeof record.title === "string" ? record.title : citationId;
    const snippet = typeof record.snippet === "string" ? record.snippet.trim() : "";
    return citationId ? [{ citationId, title, snippet }] : [];
  });
});
const originalFocusedExcerpt = computed(() => {
  const content = originalPlainText.value || originalMarkdownContent.value;
  if (!content) {
    return "";
  }
  const snippet = originalFocus.value?.snippet?.trim();
  if (!snippet) {
    return content.slice(0, 800);
  }
  const normalizedContent = content.replace(/\s+/g, " ");
  const normalizedSnippet = snippet.replace(/\s+/g, " ");
  const index = normalizedContent.indexOf(normalizedSnippet);
  if (index < 0) {
    return snippet;
  }
  const start = Math.max(0, index - 180);
  const end = Math.min(normalizedContent.length, index + normalizedSnippet.length + 180);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedContent.length ? "..." : "";
  return `${prefix}${normalizedContent.slice(start, end).trim()}${suffix}`;
});
const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const renderHighlightedText = (text: string, snippet: string) => {
  if (!text) {
    return "";
  }
  if (!snippet.trim()) {
    return escapeHtml(text).replaceAll("\n", "<br>");
  }
  const originalIndex = text.toLowerCase().indexOf(snippet.trim().toLowerCase());
  if (originalIndex < 0) {
    return escapeHtml(text).replaceAll("\n", "<br>");
  }
  const before = text.slice(0, originalIndex);
  const match = text.slice(originalIndex, originalIndex + snippet.trim().length);
  const after = text.slice(originalIndex + snippet.trim().length);
  return `${escapeHtml(before).replaceAll("\n", "<br>")}<mark>${escapeHtml(match)}</mark>${escapeHtml(after).replaceAll("\n", "<br>")}`;
};
const highlightedOriginalFocusedExcerpt = computed(() => {
  return renderHighlightedText(originalFocusedExcerpt.value, originalFocus.value?.snippet ?? "");
});
const renderOriginalBlockHtml = (block: string, index: number) =>
  renderHighlightedText(
    block,
    focusedOriginalBlockIndex.value === index ? originalFocus.value?.snippet ?? "" : ""
  );
const highlightedOriginalPreviewHtml = computed(() => {
  const content = originalPlainText.value;
  if (!content) {
    return "";
  }
  const snippet = originalFocus.value?.snippet?.trim();
  const normalizedContent = content.replace(/\r\n/g, "\n");
  if (!snippet) {
    return escapeHtml(normalizedContent);
  }
  const normalizedSnippet = snippet.replace(/\s+/g, " ").trim();
  const collapsedContent = normalizedContent.replace(/\s+/g, " ");
  const index = collapsedContent.indexOf(normalizedSnippet);
  if (index < 0) {
    return escapeHtml(normalizedContent);
  }
  const start = Math.max(0, index - 500);
  const end = Math.min(collapsedContent.length, index + normalizedSnippet.length + 500);
  const prefix = start > 0 ? "...\n" : "";
  const suffix = end < collapsedContent.length ? "\n..." : "";
  const before = collapsedContent.slice(start, index);
  const match = collapsedContent.slice(index, index + normalizedSnippet.length);
  const after = collapsedContent.slice(index + normalizedSnippet.length, end);
  return `${escapeHtml(prefix + before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after + suffix)}`;
});
const renderedOriginalHtml = computed(() => {
  if (renderedOriginalMarkdown.value) {
    return renderedOriginalMarkdown.value;
  }
  if (originalPlainText.value) {
    return md.render(originalPlainText.value);
  }
  return "";
});
const articleKeywords = computed(() => {
  const raw = detailRecord.value?.summary_meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const items = (raw as Record<string, unknown>).article_keywords;
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const keyword = typeof record.keyword === "string" ? record.keyword.trim() : "";
    const weight = typeof record.weight === "number" ? record.weight : Number(record.weight ?? 0);
    return keyword ? [{ keyword, weight }] : [];
  });
});
const readingFocus = computed(() => {
  const raw = detailRecord.value?.summary_meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const items = (raw as Record<string, unknown>).reading_focus;
  return Array.isArray(items) ? items.map((item) => String(item)).filter(Boolean) : [];
});
const keyPoints = computed(() => {
  const raw = detailRecord.value?.summary_meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const items = (raw as Record<string, unknown>).key_points;
  return Array.isArray(items) ? items.map((item) => String(item)).filter(Boolean) : [];
});
const oneSentenceTakeaway = computed(() => {
  const raw = detailRecord.value?.summary_meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "";
  }
  const value = (raw as Record<string, unknown>).one_sentence_takeaway;
  return typeof value === "string" ? value.trim() : "";
});
const methodsOrProcess = computed(() => {
  const raw = detailRecord.value?.summary_meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const items = (raw as Record<string, unknown>).methods_or_process;
  return Array.isArray(items) ? items.map((item) => String(item)).filter(Boolean) : [];
});
const pitfallsOrLimits = computed(() => {
  const raw = detailRecord.value?.summary_meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const items = (raw as Record<string, unknown>).pitfalls_or_limits;
  return Array.isArray(items) ? items.map((item) => String(item)).filter(Boolean) : [];
});
const codeExamples = computed(() => {
  const raw = detailRecord.value?.summary_meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const items = (raw as Record<string, unknown>).code_examples;
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const snippet = typeof record.snippet === "string" ? record.snippet.trim() : "";
    if (!snippet) {
      return [];
    }
    return [
      {
        language: typeof record.language === "string" ? record.language.trim() || "text" : "text",
        snippet,
      }
    ];
  });
});
const readerGuide = computed(() => {
  const raw = detailRecord.value?.summary_meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const guide = (raw as Record<string, unknown>).reader_guide;
  if (!guide || typeof guide !== "object" || Array.isArray(guide)) {
    return null;
  }
  const record = guide as Record<string, unknown>;
  const normalizeList = (value: unknown) =>
    Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
  const normalized = {
    whatItIs: typeof record.what_it_is === "string" ? record.what_it_is.trim() : "",
    whyItMatters: typeof record.why_it_matters === "string" ? record.why_it_matters.trim() : "",
    howToApply: normalizeList(record.how_to_apply),
    coreConcepts: normalizeList(record.core_concepts),
    studyPath: normalizeList(record.study_path)
  };
  const hasContent =
    normalized.whatItIs ||
    normalized.whyItMatters ||
    normalized.howToApply.length ||
    normalized.coreConcepts.length ||
    normalized.studyPath.length;
  return hasContent ? normalized : null;
});
const editableTags = computed(() =>
  form.final_tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
);

const detailMeta = computed(() => {
  if (!detail.value) {
    return "";
  }

  const parts = [
    detail.value.created_at ? `创建于 ${formatDateTime(detail.value.created_at)}` : "",
    detail.value.edited_at ? `编辑于 ${formatDateTime(detail.value.edited_at)}` : "",
    detail.value.summary_run_id ? `关联 run_id ${detail.value.summary_run_id}` : ""
  ].filter(Boolean);

  return parts.join(" · ");
});

const openRelatedItem = (itemSnapshotId: string) => {
  router.push({
    name: "item-detail",
    params: { snapshotId: itemSnapshotId }
  });
};

const findBestOriginalBlockIndex = (snippet: string) => {
  const normalizedSnippet = normalizeForMatch(snippet);
  if (!normalizedSnippet) {
    return null;
  }
  const directIndex = originalBlocks.value.findIndex((block) =>
    normalizeForMatch(block).includes(normalizedSnippet)
  );
  if (directIndex >= 0) {
    return directIndex;
  }

  const tokens = normalizedSnippet.split(" ").filter((token) => token.length >= 3);
  let bestIndex: number | null = null;
  let bestScore = 0;
  originalBlocks.value.forEach((block, index) => {
    const normalizedBlock = normalizeForMatch(block);
    const score = tokens.reduce(
      (total, token) => total + (normalizedBlock.includes(token) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore > 0 ? bestIndex : null;
};

const setOriginalBlockRef = (
  index: number,
  element: Element | ComponentPublicInstance | null
) => {
  originalBlockRefs.value[index] = element instanceof HTMLElement ? element : null;
};

const sanitizeFilenameStem = (value: string) => {
  const normalized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || `original-${snapshotId.value}`;
};

const clearRenderedReaderHighlight = () => {
  if (focusedReaderElement.value) {
    focusedReaderElement.value.classList.remove("is-reader-focused");
    focusedReaderElement.value = null;
  }
};

const findBestRenderedReaderElement = (snippet: string) => {
  const container = readerContentRef.value;
  const normalizedSnippet = normalizeForMatch(snippet);
  if (!container || !normalizedSnippet) {
    return null;
  }

  const candidates = Array.from(
    container.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th")
  ).filter((element): element is HTMLElement => element instanceof HTMLElement);

  if (!candidates.length) {
    return null;
  }

  const directMatch = candidates.find((element) =>
    normalizeForMatch(element.innerText || element.textContent || "").includes(normalizedSnippet)
  );
  if (directMatch) {
    return directMatch;
  }

  const tokens = normalizedSnippet.split(" ").filter((token) => token.length >= 2);
  let bestElement: HTMLElement | null = null;
  let bestScore = 0;

  candidates.forEach((element) => {
    const normalizedText = normalizeForMatch(element.innerText || element.textContent || "");
    const score = tokens.reduce(
      (total, token) => total + (normalizedText.includes(token) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      bestElement = element;
    }
  });

  return bestScore > 0 ? bestElement : null;
};

const load = async () => {
  if (missingSnapshotId.value) {
    detail.value = null;
    endpointUnavailable.value = false;
    connectionUnavailable.value = false;
    error.value = "缺少 snapshot_id。";
    return;
  }

  loading.value = true;
  endpointUnavailable.value = false;
  connectionUnavailable.value = false;
  error.value = null;

  try {
    detail.value = await api.getResult(snapshotId.value);
    activeParseResult.value = null;
    originalFocus.value = null;
    focusedOriginalBlockIndex.value = null;
    readerVisible.value = false;
    clearRenderedReaderHighlight();
    if (detail.value?.knowledge_item_id) {
      try {
        const parseEnvelope = await api.getActiveParseResult(detail.value.knowledge_item_id);
        activeParseResult.value = parseEnvelope.parse_result as unknown as Record<string, unknown>;
      } catch {
        activeParseResult.value = null;
      }
    }
    form.final_category = detail.value.final_category ?? detail.value.generated_category ?? "";
    form.final_tags = (detail.value.final_tags ?? detail.value.generated_tags ?? []).join(", ");
    editMode.value = false;
    newTag.value = "";
  } catch (errorValue) {
    endpointUnavailable.value = errorValue instanceof ApiError && errorValue.endpointUnavailable;
    connectionUnavailable.value = errorValue instanceof NetworkError;
    detail.value = null;
    error.value = (errorValue as Error).message;
  } finally {
    loading.value = false;
  }
};

const focusOriginalBySnippet = async (snippet: string, label: string) => {
  if (!snippet.trim()) {
    return;
  }
  readerVisible.value = true;
  originalFocus.value = { label, snippet };
  focusedOriginalBlockIndex.value = findBestOriginalBlockIndex(snippet);
  await nextTick();
  clearRenderedReaderHighlight();
  const matchedElement = findBestRenderedReaderElement(snippet);
  if (matchedElement) {
    matchedElement.classList.add("is-reader-focused");
    focusedReaderElement.value = matchedElement;
    matchedElement.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    return;
  }
  if (focusedOriginalBlockIndex.value !== null) {
    originalBlockRefs.value[focusedOriginalBlockIndex.value]?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
};

const focusOriginalBySummaryItem = (
  item: string,
  kind: "reading_focus" | "key_point" | "reader_guide"
) => {
  const labelMap = {
    reading_focus: "阅读重点",
    key_point: "关键知识点",
    reader_guide: "学习导读"
  } as const;
  focusOriginalBySnippet(item, `${labelMap[kind]} · ${item}`);
};

const openOriginalReader = () => {
  if (!hasOriginalReaderContent.value) {
    noticesStore.push({
      kind: "warning",
      title: "找不到原文",
      message: "当前条目没有可展示的原文内容。"
    });
    return;
  }
  readerVisible.value = true;
};

const clearOriginalFocus = () => {
  originalFocus.value = null;
  focusedOriginalBlockIndex.value = null;
  clearRenderedReaderHighlight();
};

const save = async () => {
  saving.value = true;
  try {
    detail.value = await api.updateResult(snapshotId.value, {
      final_category: form.final_category.trim() || null,
      final_tags: form.final_tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    });
    noticesStore.push({
      kind: "success",
      title: "结果已保存",
      message: "最终分类和标签已更新。"
    });
    editMode.value = false;
  } catch (errorValue) {
    noticesStore.push({
      kind: "error",
      title: "保存失败",
      message: (errorValue as Error).message
    });
  } finally {
    saving.value = false;
  }
};

const toggleEdit = async () => {
  if (editMode.value) {
    await save();
    return;
  }
  editMode.value = true;
};

const appendTag = () => {
  const value = newTag.value.trim();
  if (!value) {
    return;
  }
  const merged = [...editableTags.value, value];
  form.final_tags = Array.from(new Set(merged)).join(", ");
  newTag.value = "";
};

const removeTag = (tagToRemove: string) => {
  form.final_tags = editableTags.value.filter((tag) => tag !== tagToRemove).join(", ");
};

const openSummaryMarkdown = async () => {
  const path = detail.value?.markdown_path;
  if (!path) {
    noticesStore.push({
      kind: "warning",
      title: "找不到摘要 MD",
      message: "当前结果没有返回摘要 markdown 文件路径。"
    });
    return;
  }
  const result = await openPath(path);
  if (result) {
    noticesStore.push({
      kind: "warning",
      title: "找不到摘要 MD",
      message: result
    });
  }
};

const openSourceMarkdown = async () => {
  const directPath =
    detail.value?.source_type === "markdown" && detail.value?.source_value
      ? detail.value.source_value
      : "";
  if (directPath) {
    const result = await openPath(directPath);
    if (result) {
      noticesStore.push({
        kind: "warning",
        title: "找不到原文 MD",
        message: result
      });
    }
    return;
  }

  const originalContent = originalMarkdownContent.value || originalPlainText.value;
  if (!originalContent.trim()) {
    noticesStore.push({
      kind: "warning",
      title: "找不到原文 MD",
      message: "当前条目没有可导出的原文 markdown 内容。"
    });
    return;
  }

  const savedPath = await saveTextFile({
    title: "保存原文 Markdown",
    defaultPath: `${sanitizeFilenameStem(detail.value?.title ?? "original")}.md`,
    content: originalContent,
    filters: [{ name: "Markdown", extensions: ["md"] }]
  });
  if (!savedPath) {
    return;
  }

  const result = await openPath(savedPath);
  if (result) {
    noticesStore.push({
      kind: "warning",
      title: "找不到原文 MD",
      message: result
    });
  }
};

const feedback = async (value: "useful" | "useless") => {
  feedbackLoading.value = value;
  try {
    await api.submitFeedback(snapshotId.value, value);
    noticesStore.push({
      kind: "success",
      title: "反馈已保存",
      message: "这条反馈已经记录。"
    });
  } catch (errorValue) {
    noticesStore.push({
      kind: "warning",
      title: "反馈提交失败",
      message: (errorValue as Error).message
    });
  } finally {
    feedbackLoading.value = null;
  }
};

onMounted(() => {
  void load();
});

watch(
  () => route.params.snapshotId,
  () => {
    void load();
  }
);
</script>

<template>
  <div class="page-stack">
    <EmptyState
      v-if="missingSnapshotId"
      title="缺少结果标识"
      description="请从周报结果列表进入本页，或提供有效的 snapshot_id。"
    />

    <EmptyState
      v-else-if="loading"
      title="正在加载结果详情"
      description="正在获取总结文本、标签和反馈状态。"
    />

    <EndpointNotice
      v-else-if="connectionUnavailable"
      type="error"
      title="无法连接后端"
      detail="结果详情依赖本地后端服务，请先启动后端后再重试。"
    />

    <EndpointNotice
      v-else-if="endpointUnavailable"
      type="warning"
      title="结果接口不可用"
      detail="后端可以访问，但当前构建还没有暴露结果详情接口。"
    />

    <template v-else-if="detail">
      <article class="split-layout">
      <section class="page-stack">
        <article class="page-panel">
          <div class="page-heading">
            <div>
              <p class="panel-eyebrow">总结结果</p>
              <h3>{{ detail.title ?? detail.final_category ?? detail.generated_category ?? "待人工复核" }}</h3>
              <p v-if="detail.source_type || detail.source_value" class="secondary-text">
                {{ detail.source_type || "unknown" }}
                <span v-if="detail.source_value"> · {{ detail.source_value }}</span>
              </p>
            </div>
            <div class="toolbar__group">
              <span class="secondary-text">{{ detail.id }}</span>
              <el-button
                plain
                @click="
                  router.push(
                    route.query.runId
                      ? { name: 'run-detail', params: { runId: String(route.query.runId) } }
                      : { name: 'history' }
                  )
                "
              >
                返回
              </el-button>
            </div>
          </div>

          <p v-if="detailMeta" class="secondary-text">{{ detailMeta }}</p>

          <div class="page-stack">
            <div class="surface-card">
              <h3>摘要</h3>
              <p>{{ detail.summary_text || "暂无摘要文本。" }}</p>
            </div>
            <div v-if="oneSentenceTakeaway" class="surface-card">
              <h3>一句话结论</h3>
              <p>{{ oneSentenceTakeaway }}</p>
            </div>
            <div class="surface-card">
              <h3>模型生成标签</h3>
              <p>
                分类：{{ detail.generated_category || "无" }}
                <br />
                标签：{{ (detail.generated_tags ?? []).join(", ") || "无" }}
              </p>
            </div>
            <div class="surface-card">
              <h3>输出文件</h3>
              <p>
                文件名：{{ detail.markdown_filename || "未生成" }}
                <br />
                路径：{{ detail.markdown_path || "未返回" }}
              </p>
              <div class="page-panel__actions">
                <el-button plain type="primary" @click="openSummaryMarkdown">打开摘要 MD</el-button>
                <el-button plain @click="openSourceMarkdown">打开原文 MD</el-button>
                <el-button plain @click="openOriginalReader">打开原文阅读器</el-button>
              </div>
            </div>
            <div v-if="articleKeywords.length" class="surface-card">
              <h3>文章关键词</h3>
              <div class="toolbar__group">
                <el-tag v-for="item in articleKeywords" :key="item.keyword" round>
                  {{ item.keyword }} · {{ item.weight.toFixed(2) }}
                </el-tag>
              </div>
            </div>
            <div v-if="readingFocus.length" class="surface-card">
              <h3>阅读重点</h3>
              <ul>
                <li v-for="item in readingFocus" :key="item" class="toolbar__group">
                  <span>{{ item }}</span>
                  <el-button plain size="small" @click="focusOriginalBySummaryItem(item, 'reading_focus')">
                    定位重点
                  </el-button>
                </li>
              </ul>
            </div>
            <div v-if="keyPoints.length" class="surface-card">
              <h3>关键知识点</h3>
              <ul>
                <li v-for="item in keyPoints" :key="item" class="toolbar__group">
                  <span>{{ item }}</span>
                  <el-button plain size="small" @click="focusOriginalBySummaryItem(item, 'key_point')">
                    定位知识点
                  </el-button>
                </li>
              </ul>
            </div>
            <div v-if="readerGuide" class="surface-card">
              <h3>学习导读</h3>
              <div class="page-stack">
                <div v-if="readerGuide.whatItIs">
                  <div class="page-heading">
                    <strong>是什么</strong>
                    <el-button
                      plain
                      size="small"
                      @click="focusOriginalBySummaryItem(readerGuide.whatItIs, 'reader_guide')"
                    >
                      定位到原文
                    </el-button>
                  </div>
                  <p>{{ readerGuide.whatItIs }}</p>
                </div>
                <div v-if="readerGuide.whyItMatters">
                  <div class="page-heading">
                    <strong>为什么重要</strong>
                    <el-button
                      plain
                      size="small"
                      @click="focusOriginalBySummaryItem(readerGuide.whyItMatters, 'reader_guide')"
                    >
                      定位到原文
                    </el-button>
                  </div>
                  <p>{{ readerGuide.whyItMatters }}</p>
                </div>
                <div v-if="readerGuide.howToApply.length">
                  <strong>怎么学</strong>
                  <ol>
                    <li v-for="item in readerGuide.howToApply" :key="item" class="toolbar__group">
                      <span>{{ item }}</span>
                      <el-button plain size="small" @click="focusOriginalBySummaryItem(item, 'reader_guide')">
                        定位到原文
                      </el-button>
                    </li>
                  </ol>
                </div>
                <div v-if="readerGuide.coreConcepts.length">
                  <strong>核心概念</strong>
                  <ul>
                    <li v-for="item in readerGuide.coreConcepts" :key="item" class="toolbar__group">
                      <span>{{ item }}</span>
                      <el-button plain size="small" @click="focusOriginalBySummaryItem(item, 'reader_guide')">
                        定位到原文
                      </el-button>
                    </li>
                  </ul>
                </div>
                <div v-if="readerGuide.studyPath.length">
                  <strong>阅读路径</strong>
                  <ul>
                    <li v-for="item in readerGuide.studyPath" :key="item" class="toolbar__group">
                      <span>{{ item }}</span>
                      <el-button plain size="small" @click="focusOriginalBySummaryItem(item, 'reader_guide')">
                        定位到原文
                      </el-button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div v-if="methodsOrProcess.length" class="surface-card">
              <h3>方法或流程</h3>
              <ol>
                <li v-for="item in methodsOrProcess" :key="item">{{ item }}</li>
              </ol>
            </div>
            <div v-if="pitfallsOrLimits.length" class="surface-card">
              <h3>注意点与局限</h3>
              <ul>
                <li v-for="item in pitfallsOrLimits" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div v-if="codeExamples.length" class="surface-card">
              <h3>关键代码</h3>
              <div class="page-stack">
                <article
                  v-for="item in codeExamples"
                  :key="`${item.language}-${item.snippet}`"
                  class="surface-card surface-card--nested"
                >
                  <p class="panel-eyebrow">{{ item.language }}</p>
                  <pre><code>{{ item.snippet }}</code></pre>
                </article>
              </div>
            </div>
            <div v-if="renderedMarkdown" class="surface-card">
              <h3>Markdown 预览</h3>
              <div class="markdown-body" v-html="renderedMarkdown" />
            </div>
            <div v-if="evidenceCitations.length" class="surface-card">
              <h3>原文证据定位</h3>
              <div class="page-stack">
                <article
                  v-for="citation in evidenceCitations"
                  :key="citation.citationId"
                  class="surface-card surface-card--nested"
                >
                  <div class="page-heading">
                    <div>
                      <h3>{{ citation.title }}</h3>
                      <p class="secondary-text">{{ citation.citationId }}</p>
                    </div>
                    <el-button
                      plain
                      type="primary"
                      @click="focusOriginalBySnippet(citation.snippet, citation.title)"
                    >
                      定位到原文
                    </el-button>
                  </div>
                  <p class="secondary-text">{{ citation.snippet || "暂无片段" }}</p>
                </article>
              </div>
            </div>
            <div v-if="summaryMetaEntries.length" class="surface-card">
              <h3>摘要元信息</h3>
              <div class="meta-list">
                <div v-for="entry in summaryMetaEntries" :key="entry.key">
                  <span>{{ entry.key }}</span>
                  <strong>{{ entry.value }}</strong>
                </div>
              </div>
            </div>
            <div v-if="relationMetaEntries.length" class="surface-card">
              <h3>关联元信息</h3>
              <div class="meta-list">
                <div v-for="entry in relationMetaEntries" :key="entry.key">
                  <span>{{ entry.key }}</span>
                  <strong>{{ entry.value }}</strong>
                </div>
              </div>
            </div>
            <div v-if="relatedItems.length" class="surface-card">
              <h3>关联内容</h3>
              <div class="page-stack">
                <article v-for="item in relatedItems" :key="item.snapshotId" class="surface-card surface-card--nested">
                  <div class="page-heading">
                    <div>
                      <h3>{{ item.title }}</h3>
                      <p class="secondary-text">
                        {{ item.finalCategory || "待分类" }}
                        <span v-if="item.sourceType"> · {{ item.sourceType }}</span>
                        <span v-if="item.createdAt"> · {{ formatDateTime(item.createdAt) }}</span>
                      </p>
                    </div>
                    <el-button plain type="primary" @click="openRelatedItem(item.snapshotId)">
                      查看详情
                    </el-button>
                  </div>
                  <p class="secondary-text" v-if="item.relationReason">{{ item.relationReason }}</p>
                  <p class="secondary-text">{{ item.snapshotId }}</p>
                </article>
              </div>
            </div>
          </div>
        </article>
      </section>

      <aside class="sticky-column">
        <article class="surface-card">
          <p class="panel-eyebrow">人工复核</p>
          <el-form label-position="top">
            <el-form-item label="最终分类">
              <el-input
                v-if="editMode"
                v-model="form.final_category"
                placeholder="输入人工确认后的分类"
              />
              <div v-else class="secondary-text">{{ form.final_category || "未设置" }}</div>
            </el-form-item>
            <el-form-item label="最终标签">
              <div class="page-stack">
                <div class="toolbar__group">
                  <el-tag
                    v-for="tag in editableTags"
                    :key="tag"
                    :closable="editMode"
                    @close="removeTag(tag)"
                  >
                    {{ tag }}
                  </el-tag>
                  <span v-if="!editableTags.length" class="secondary-text">未设置</span>
                </div>
                <div v-if="editMode" class="toolbar__group">
                  <el-input
                    v-model="newTag"
                    placeholder="输入标签后确认"
                    @keyup.enter="appendTag"
                  />
                  <el-button plain @click="appendTag">确认</el-button>
                </div>
              </div>
            </el-form-item>
          </el-form>

          <div class="page-panel__actions">
            <el-button type="primary" :loading="saving" @click="toggleEdit">
              {{ editMode ? "保存" : "编辑" }}
            </el-button>
            <el-button plain :loading="feedbackLoading === 'useful'" @click="feedback('useful')">
              有用
            </el-button>
            <el-button
              plain
              type="danger"
              :loading="feedbackLoading === 'useless'"
              @click="feedback('useless')"
            >
              无用
            </el-button>
          </div>
        </article>
      </aside>
      </article>

      <el-drawer
        v-model="readerVisible"
        class="item-detail__reader-drawer"
        size="48%"
        title="原文阅读器"
      >
        <div v-if="hasOriginalReaderContent" class="item-detail__reader-card">
          <section class="surface-card item-detail__reader-meta">
            <div class="page-heading">
              <div>
                <h3>{{ detail.title ?? "原文" }}</h3>
                <p class="secondary-text">
                  {{ parseResultRecord?.parser_name ? `解析器 ${parseResultRecord.parser_name}` : "使用当前激活解析结果" }}
                </p>
              </div>
              <div class="toolbar__group">
                <el-button plain @click="openSourceMarkdown">打开原文 MD</el-button>
                <el-button v-if="originalFocus" plain @click="clearOriginalFocus">清除定位</el-button>
              </div>
            </div>
            <div v-if="originalFocus" class="secondary-text item-detail__reader-hit">
              <strong>命中位置：</strong>{{ originalFocus.label }}
            </div>
          </section>

          <div
            ref="readerContentRef"
            class="markdown-body item-detail__reader-markdown"
            v-html="renderedOriginalHtml"
          />
        </div>
        <EmptyState
          v-else
          title="原文不可用"
          description="当前条目没有可展示的原文内容。"
        />
      </el-drawer>
    </template>

    <EmptyState
      v-else
      title="结果详情不可用"
      :description="error ?? '请提供有效的 snapshot_id 后重试。'"
    />
  </div>
</template>

<style scoped>
.item-detail__reader-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.item-detail__reader-drawer :deep(.el-drawer__header),
.item-detail__reader-drawer :deep(.el-drawer__body) {
  background:
    radial-gradient(circle at top right, rgba(240, 219, 186, 0.18), transparent 28%),
    linear-gradient(180deg, rgba(250, 245, 236, 0.98), rgba(245, 237, 224, 0.98));
}

.item-detail__reader-drawer :deep(.el-drawer__body) {
  padding-top: 8px;
  overflow: hidden;
}

.item-detail__reader-meta {
  position: sticky;
  top: 0;
  z-index: 1;
  border: 1px solid rgba(191, 161, 128, 0.18);
  background: rgba(255, 251, 244, 0.94);
  backdrop-filter: blur(8px);
}

.item-detail__reader-hit {
  padding-top: 8px;
}

.item-detail__reader-markdown {
  overflow: auto;
  padding: 20px 24px 40px;
  border-radius: 20px;
  background: rgba(255, 253, 249, 0.92);
  border: 1px solid rgba(191, 161, 128, 0.16);
  line-height: 1.8;
  min-height: 0;
  max-height: calc(100vh - 220px);
}

.item-detail__reader-markdown :deep(.is-reader-focused) {
  scroll-margin-top: 28px;
  border-radius: 10px;
  background: rgba(250, 204, 21, 0.18);
  box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.18);
}

.item-detail__reader-markdown :deep(pre.is-reader-focused) {
  padding: 16px;
}

.secondary-text :deep(mark) {
  background: rgba(250, 204, 21, 0.45);
  padding: 0 2px;
  border-radius: 2px;
}

@media (max-width: 1100px) {
  .item-detail__reader-markdown {
    max-height: none;
  }
}
</style>
