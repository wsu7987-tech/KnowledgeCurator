<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { FolderOpened, InfoFilled, Loading } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";

import { chooseDirectory, hasDirectoryPicker, updateShellConfig } from "@/services/desktop-bridge";
import { formatDateTime } from "@/services/format";
import {
  buildSettingsSavePayload,
  hasDesktopShellConfigChanges
} from "@/services/settingsShellConfig";
import { useConfigStore } from "@/stores/config";
import { useNoticesStore } from "@/stores/notices";
import type { AppConfigPayload } from "@/types";
import EndpointNotice from "./EndpointNotice.vue";
import SystemStatusChip from "./SystemStatusChip.vue";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (event: "update:open", value: boolean): void;
}>();

const configStore = useConfigStore();
const noticesStore = useNoticesStore();
const supportsDirectoryPicker = hasDirectoryPicker();

type ShortcutField = "quick_capture_hotkey" | "quick_capture_screenshot_hotkey";

const form = reactive({
  output_root: "",
  summary_output_dir: "",
  report_output_dir: "",
  llm_provider: "",
  llm_model: "",
  llm_base_url: "",
  llm_api_key: "",
  embedding_provider: "",
  embedding_model: "",
  embedding_base_url: "",
  embedding_api_key: "",
  fetch_concurrency: 1,
  llm_concurrency: 1,
  embedding_concurrency: 1,
  quick_capture_hotkey: "",
  quick_capture_screenshot_hotkey: "",
  close_to_tray: true,
  quick_capture_always_on_top: true
});

const llmProviderOptions = [
  { label: "OpenAI", value: "openai" },
  { label: "OpenAI Compatible", value: "openai-compatible" },
  { label: "Stub (本地测试)", value: "stub-llm" }
] as const;

const embeddingProviderOptions = [
  { label: "OpenAI", value: "openai" },
  { label: "OpenAI Compatible", value: "openai-compatible" },
  { label: "Stub (本地测试)", value: "stub-embedding" }
] as const;

const normalizeLlmProvider = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "deepseek") {
    return "openai-compatible";
  }
  return value?.trim() ?? "";
};

const normalizeEmbeddingProvider = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (["qianwen", "qwen", "dashscope", "aliyun"].includes(normalized)) {
    return "openai-compatible";
  }
  return value?.trim() ?? "";
};

const fieldHints = {
  output_root: "所有导出文件的总根目录，下面的总结和周报目录都会以这里为基础组织。",
  summary_output_dir: "总结结果保存目录。",
  report_output_dir: "周报结果保存目录。",
  llm_provider: "生成总结和周报时使用的模型服务来源。",
  llm_model: "总结和周报默认使用的 LLM 模型名。",
  llm_base_url: "LLM 服务 base_url。",
  llm_api_key: "LLM 服务 api_key。留空则保持当前值不变。",
  embedding_provider: "Embedding 服务来源。",
  embedding_model: "Embedding 模型名。",
  embedding_base_url: "Embedding 服务 base_url。",
  embedding_api_key: "Embedding 服务 api_key。留空则保持当前值不变。",
  fetch_concurrency: "抓取阶段允许同时执行的最大任务数。",
  llm_concurrency: "LLM 阶段允许同时执行的最大请求数。",
  embedding_concurrency: "Embedding 阶段允许同时执行的最大任务数。",
  quick_capture_hotkey: "呼出或隐藏快速采集窗的全局快捷键。",
  quick_capture_screenshot_hotkey: "启动截图识别的全局快捷键。",
  close_to_tray: "关闭主窗口时是否隐藏到托盘并保持后台常驻。",
  quick_capture_always_on_top: "快速采集窗打开后是否始终保持置顶。"
} as const;

const isLoadingState = computed(() => configStore.loading && !configStore.hasLoaded);
const canEdit = computed(
  () => !configStore.loading && !configStore.connectionUnavailable && !configStore.endpointUnavailable
);
const readinessSummary = computed(() =>
  configStore.generationReady ? "生成链路已就绪，可直接开始总结和周报。" : configStore.generationBlockReason
);
const readinessTagType = computed(() => (configStore.generationReady ? "success" : "warning"));

const llmApiKeyTouched = ref(false);
const embeddingApiKeyTouched = ref(false);
const recordingShortcutField = ref<ShortcutField | null>(null);
const savedFormSnapshot = ref("");

const llmApiKeyConfigured = computed(
  () => Boolean(configStore.data?.llm_configured || form.llm_api_key.trim().length > 0)
);
const embeddingApiKeyConfigured = computed(
  () => Boolean(configStore.data?.embedding_configured || form.embedding_api_key.trim().length > 0)
);
const llmProviderHint = computed(() => {
  if (form.llm_provider === "openai-compatible") {
    return "DeepSeek、阿里百炼兼容接口等 OpenAI 风格服务请选择这个选项，不要直接填写 deepseek。";
  }
  if (form.llm_provider === "openai") {
    return "官方 OpenAI 接口使用这个选项，base URL 通常保持默认或填写官方地址。";
  }
  if (form.llm_provider === "stub-llm") {
    return "仅用于本地联调或测试，不具备真实生成能力。";
  }
  return "请选择后端支持的提供方，避免手填别名导致校验或调用失败。";
});
const embeddingProviderHint = computed(() => {
  if (form.embedding_provider === "openai-compatible") {
    return "通义千问 / DashScope 兼容模式请选择这个选项，不要直接填写 qianwen。";
  }
  if (form.embedding_provider === "openai") {
    return "官方 OpenAI Embedding 使用这个选项。";
  }
  if (form.embedding_provider === "stub-embedding") {
    return "仅用于本地联调或测试，语义检索效果会明显偏弱。";
  }
  return "请选择后端支持的提供方，避免手填别名导致校验或调用失败。";
});

const syncFormFromStore = () => {
  Object.assign(form, {
    output_root: configStore.data?.output_root ?? "",
    summary_output_dir: configStore.data?.summary_output_dir ?? "",
    report_output_dir: configStore.data?.report_output_dir ?? "",
    llm_provider: normalizeLlmProvider(configStore.data?.llm_provider),
    llm_model: configStore.data?.llm_model ?? "",
    llm_base_url: configStore.data?.llm_base_url ?? "",
    llm_api_key: configStore.data?.llm_api_key ?? "",
    embedding_provider: normalizeEmbeddingProvider(configStore.data?.embedding_provider),
    embedding_model: configStore.data?.embedding_model ?? "",
    embedding_base_url: configStore.data?.embedding_base_url ?? "",
    embedding_api_key: configStore.data?.embedding_api_key ?? "",
    fetch_concurrency: configStore.data?.fetch_concurrency ?? 1,
    llm_concurrency: configStore.data?.llm_concurrency ?? 1,
    embedding_concurrency: configStore.data?.embedding_concurrency ?? 1,
    quick_capture_hotkey: configStore.data?.quick_capture_hotkey ?? "",
    quick_capture_screenshot_hotkey: configStore.data?.quick_capture_screenshot_hotkey ?? "",
    close_to_tray: configStore.data?.close_to_tray ?? true,
    quick_capture_always_on_top: configStore.data?.quick_capture_always_on_top ?? true
  });
  llmApiKeyTouched.value = false;
  embeddingApiKeyTouched.value = false;
  savedFormSnapshot.value = JSON.stringify(form);
};

const hasUnsavedChanges = computed(() => savedFormSnapshot.value !== JSON.stringify(form));

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      return;
    }

    await configStore.load();
    syncFormFromStore();
  },
  { immediate: true }
);

const normalizeShortcutEvent = (event: KeyboardEvent) => {
  const modifiers: string[] = [];
  if (event.ctrlKey) {
    modifiers.push("CommandOrControl");
  }
  if (event.altKey) {
    modifiers.push("Alt");
  }
  if (event.shiftKey) {
    modifiers.push("Shift");
  }
  if (event.metaKey && !modifiers.includes("CommandOrControl")) {
    modifiers.push("Super");
  }

  if (event.key === "Escape") {
    return "Escape";
  }
  if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
    return null;
  }

  let normalizedKey = "";
  if (event.key === " ") {
    normalizedKey = "Space";
  } else if (event.key.startsWith("Arrow")) {
    normalizedKey = event.key.replace("Arrow", "");
  } else if (/^F\d{1,2}$/i.test(event.key)) {
    normalizedKey = event.key.toUpperCase();
  } else if (event.key.length === 1) {
    normalizedKey = event.key.toUpperCase();
  } else if (["Enter", "Backspace", "Delete", "Tab"].includes(event.key)) {
    normalizedKey = event.key;
  } else {
    normalizedKey = event.key;
  }

  if (!normalizedKey) {
    return null;
  }
  if (normalizedKey === "Escape") {
    return normalizedKey;
  }
  if (modifiers.length === 0) {
    return null;
  }

  return [...modifiers, normalizedKey].join("+");
};

const handleShortcutKeydown = (event: KeyboardEvent) => {
  if (!recordingShortcutField.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const normalized = normalizeShortcutEvent(event);
  if (!normalized) {
    return;
  }
  if (normalized === "Escape") {
    recordingShortcutField.value = null;
    return;
  }

  form[recordingShortcutField.value] = normalized;
  recordingShortcutField.value = null;
};

watch(recordingShortcutField, (field, previousField) => {
  if (previousField && !field) {
    window.removeEventListener("keydown", handleShortcutKeydown, true);
  }
  if (field) {
    window.addEventListener("keydown", handleShortcutKeydown, true);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleShortcutKeydown, true);
});

const beginShortcutRecording = (field: ShortcutField) => {
  recordingShortcutField.value = field;
};

const cancelShortcutRecording = () => {
  recordingShortcutField.value = null;
};

const confirmDiscardChanges = async () => {
  if (!hasUnsavedChanges.value) {
    return true;
  }

  try {
    await ElMessageBox.confirm(
      "当前设置里有尚未保存的修改。关闭后这些修改会丢失。",
      "放弃未保存修改？",
      {
        confirmButtonText: "放弃修改",
        cancelButtonText: "继续编辑",
        type: "warning"
      }
    );
    syncFormFromStore();
    return true;
  } catch {
    return false;
  }
};

const requestClose = async () => {
  if (await confirmDiscardChanges()) {
    emit("update:open", false);
  }
};

const handleBeforeClose = async (done: () => void) => {
  if (await confirmDiscardChanges()) {
    done();
  }
};

const save = async () => {
  try {
    const shouldUpdateShellConfig = hasDesktopShellConfigChanges(form, configStore.data);
    const payload: Partial<AppConfigPayload> = buildSettingsSavePayload(form, {
      llmApiKeyTouched: llmApiKeyTouched.value,
      embeddingApiKeyTouched: embeddingApiKeyTouched.value
    });

    await configStore.save(payload);
    if (shouldUpdateShellConfig) {
      await updateShellConfig({
        quickCaptureHotkey: form.quick_capture_hotkey,
        quickCaptureScreenshotHotkey: form.quick_capture_screenshot_hotkey,
        closeToTray: form.close_to_tray,
        quickCaptureAlwaysOnTop: form.quick_capture_always_on_top
      });
    }
    syncFormFromStore();
    noticesStore.push({
      kind: "success",
      title: "配置已保存",
      message: "配置已同步到后端。"
    });
  } catch {
    noticesStore.push({
      kind: "error",
      title: "配置保存失败",
      message: configStore.error ?? "请稍后重试。"
    });
  }
};

const pushShortcutRegistrationNotice = (
  field: ShortcutField,
  result:
    | {
        quickCaptureRegistered: boolean;
        screenshotRegistered: boolean;
      }
    | null
) => {
  const registered =
    field === "quick_capture_hotkey"
      ? result?.quickCaptureRegistered
      : result?.screenshotRegistered;

  if (registered) {
    noticesStore.push({
      kind: "success",
      title: "快捷键已保存",
      message:
        field === "quick_capture_hotkey" ? "快速采集窗快捷键已生效。" : "截图识别快捷键已生效。"
    });
    return;
  }

  noticesStore.push({
    kind: "warning",
    title: "快捷键保存成功，但注册失败",
    message: "当前快捷键可能与系统或其他应用冲突，请换一个组合键后再保存。"
  });
};

const saveShortcutField = async (field: ShortcutField) => {
  try {
    await configStore.save({
      [field]: form[field] || null
    });
    const result = await updateShellConfig(
      field === "quick_capture_hotkey"
        ? { quickCaptureHotkey: form.quick_capture_hotkey }
        : { quickCaptureScreenshotHotkey: form.quick_capture_screenshot_hotkey }
    );
    syncFormFromStore();
    pushShortcutRegistrationNotice(field, result);
  } catch {
    noticesStore.push({
      kind: "error",
      title: "快捷键保存失败",
      message: configStore.error ?? "请稍后重试。"
    });
  }
};

const saveDesktopPreferences = async () => {
  try {
    await configStore.save({
      close_to_tray: form.close_to_tray,
      quick_capture_always_on_top: form.quick_capture_always_on_top
    });
    await updateShellConfig({
      closeToTray: form.close_to_tray,
      quickCaptureAlwaysOnTop: form.quick_capture_always_on_top
    });
    syncFormFromStore();
    noticesStore.push({
      kind: "success",
      title: "桌面设置已保存",
      message: "后台托管和置顶行为已更新。"
    });
  } catch {
    noticesStore.push({
      kind: "error",
      title: "桌面设置保存失败",
      message: configStore.error ?? "请稍后重试。"
    });
  }
};

const runLlmCheck = async () => {
  try {
    await configStore.testLlmConnection();
    noticesStore.push({
      kind: "success",
      title: "LLM 连通测试完成",
      message: configStore.llmStatus.detail
    });
  } catch {
    noticesStore.push({
      kind: "warning",
      title: "LLM 连通测试失败",
      message: configStore.llmStatus.detail
    });
  }
};

const runEmbeddingCheck = async () => {
  try {
    await configStore.testEmbeddingConnection();
    noticesStore.push({
      kind: "success",
      title: "Embedding 连通测试完成",
      message: configStore.embeddingStatus.detail
    });
  } catch {
    noticesStore.push({
      kind: "warning",
      title: "Embedding 连通测试失败",
      message: configStore.embeddingStatus.detail
    });
  }
};

const markLlmApiKeyTouched = () => {
  llmApiKeyTouched.value = true;
};

const markEmbeddingApiKeyTouched = () => {
  embeddingApiKeyTouched.value = true;
};

const pickDirectory = async (
  field: "output_root" | "summary_output_dir" | "report_output_dir",
  title: string
) => {
  const selected = await chooseDirectory({ title });
  if (!selected) {
    return;
  }

  form[field] = selected;
};
</script>

<template>
  <el-drawer
    class="settings-drawer"
    :model-value="open"
    size="520px"
    title="路径与模型配置"
    :before-close="handleBeforeClose"
    @close="emit('update:open', false)"
  >
    <div class="settings-workbench">
      <section class="settings-hero">
        <div>
          <p class="panel-eyebrow">System Configuration</p>
          <h3>路径、模型与执行能力</h3>
          <p class="secondary-text">统一管理模型、目录、后台托管和快捷键设置。</p>
        </div>
        <el-tag size="large" :type="readinessTagType">
          {{ configStore.generationReady ? "生成链路已就绪" : "生成链路待处理" }}
        </el-tag>
      </section>

      <div class="settings-status-grid">
        <SystemStatusChip label="Backend" :state="configStore.backendStatus" />
        <SystemStatusChip label="LLM" :state="configStore.llmStatus" />
        <SystemStatusChip label="Embedding" :state="configStore.embeddingStatus" />
      </div>

      <section class="settings-summary-card">
        <span class="settings-summary-card__label">当前摘要</span>
        <strong>{{ readinessSummary }}</strong>
      </section>

      <div v-if="isLoadingState" class="page-stack">
        <p class="secondary-text">正在从后端加载配置…</p>
      </div>

      <EndpointNotice
        v-else-if="configStore.connectionUnavailable"
        type="error"
        title="无法连接后端"
        detail="配置抽屉依赖本地后端服务，请先启动后端后再重试。"
      />

      <EndpointNotice
        v-else-if="configStore.endpointUnavailable"
        type="warning"
        title="配置接口不可用"
        detail="当前后端版本还未提供配置接口，请更新后端后重试。"
      />

      <EndpointNotice
        v-else-if="configStore.error"
        type="warning"
        title="配置加载出错"
        :detail="configStore.error"
      />

      <el-form v-else label-position="top" class="settings-form">
        <section class="settings-section">
          <div class="settings-section__header">
            <div>
              <p class="panel-eyebrow">Desktop</p>
              <h4>后台托管与快捷键</h4>
            </div>
            <span class="secondary-text">快捷键必须录制后单独保存，不再自由输入字符串。</span>
          </div>

          <el-form-item>
            <template #label>
              <span class="setting-label">
                <span>快速采集窗快捷键</span>
                <el-tooltip :content="fieldHints.quick_capture_hotkey" effect="dark" placement="top" :show-after="150">
                  <el-icon class="setting-label__hint"><InfoFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <div class="desktop-shortcut-row">
              <el-input :model-value="form.quick_capture_hotkey" readonly placeholder="点击录制后按下组合键" />
              <el-button
                plain
                @click="
                  recordingShortcutField === 'quick_capture_hotkey'
                    ? cancelShortcutRecording()
                    : beginShortcutRecording('quick_capture_hotkey')
                "
              >
                {{ recordingShortcutField === "quick_capture_hotkey" ? "取消录制" : "开始录制" }}
              </el-button>
              <el-button type="primary" plain @click="saveShortcutField('quick_capture_hotkey')">
                保存快捷键
              </el-button>
            </div>
            <span class="secondary-text">
              {{
                recordingShortcutField === "quick_capture_hotkey"
                  ? "正在录制，请直接按下组合键。按 Esc 取消。"
                  : "建议使用带 Ctrl/Alt/Shift 的组合键。"
              }}
            </span>
          </el-form-item>

          <el-form-item>
            <template #label>
              <span class="setting-label">
                <span>截图识别快捷键</span>
                <el-tooltip :content="fieldHints.quick_capture_screenshot_hotkey" effect="dark" placement="top" :show-after="150">
                  <el-icon class="setting-label__hint"><InfoFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <div class="desktop-shortcut-row">
              <el-input
                :model-value="form.quick_capture_screenshot_hotkey"
                readonly
                placeholder="点击录制后按下组合键"
              />
              <el-button
                plain
                @click="
                  recordingShortcutField === 'quick_capture_screenshot_hotkey'
                    ? cancelShortcutRecording()
                    : beginShortcutRecording('quick_capture_screenshot_hotkey')
                "
              >
                {{
                  recordingShortcutField === "quick_capture_screenshot_hotkey"
                    ? "取消录制"
                    : "开始录制"
                }}
              </el-button>
              <el-button
                type="primary"
                plain
                @click="saveShortcutField('quick_capture_screenshot_hotkey')"
              >
                保存快捷键
              </el-button>
            </div>
            <span class="secondary-text">
              {{
                recordingShortcutField === "quick_capture_screenshot_hotkey"
                  ? "正在录制，请直接按下组合键。按 Esc 取消。"
                  : "建议不要与系统截图快捷键冲突。"
              }}
            </span>
          </el-form-item>

          <el-form-item label="关闭主窗口后隐藏到托盘">
            <el-switch v-model="form.close_to_tray" />
          </el-form-item>

          <el-form-item label="快速采集窗始终置顶">
            <el-switch v-model="form.quick_capture_always_on_top" />
          </el-form-item>

          <div class="setting-actions">
            <el-button type="primary" plain @click="saveDesktopPreferences">保存桌面设置</el-button>
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section__header">
            <div>
              <p class="panel-eyebrow">Workspace</p>
              <h4>输出路径</h4>
            </div>
            <span class="secondary-text">这些目录会影响总结和周报的落盘位置。</span>
          </div>

          <el-form-item label="输出根目录">
            <el-input
              v-model="form.output_root"
              name="output_root"
              autocomplete="off"
              placeholder="例如：D:\\KnowledgeCurator\\outputs…"
            >
              <template v-if="supportsDirectoryPicker" #append>
                <el-button
                  :icon="FolderOpened"
                  aria-label="选择输出根目录"
                  @click="pickDirectory('output_root', '选择输出根目录')"
                />
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="总结输出目录">
            <el-input v-model="form.summary_output_dir" name="summary_output_dir" autocomplete="off">
              <template v-if="supportsDirectoryPicker" #append>
                <el-button
                  :icon="FolderOpened"
                  aria-label="选择总结输出目录"
                  @click="pickDirectory('summary_output_dir', '选择总结输出目录')"
                />
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="周报输出目录">
            <el-input v-model="form.report_output_dir" name="report_output_dir" autocomplete="off">
              <template v-if="supportsDirectoryPicker" #append>
                <el-button
                  :icon="FolderOpened"
                  aria-label="选择周报输出目录"
                  @click="pickDirectory('report_output_dir', '选择周报输出目录')"
                />
              </template>
            </el-input>
          </el-form-item>
        </section>

        <section class="settings-section">
          <div class="settings-section__header">
            <div>
              <p class="panel-eyebrow">LLM</p>
              <h4>文本生成能力</h4>
            </div>
            <span class="secondary-text">影响总结生成、周报生成和文本整理流程。</span>
          </div>

          <el-form-item>
            <el-select v-model="form.llm_provider" placeholder="请选择 LLM 提供方" style="width: 100%">
              <el-option
                v-for="option in llmProviderOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <template #label>
              <span class="setting-label">
                <span>LLM 提供方</span>
                <el-tooltip :content="llmProviderHint" effect="dark" placement="top" :show-after="150">
                  <el-icon class="setting-label__hint"><InfoFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
          </el-form-item>

          <el-form-item label="LLM 模型">
            <el-input v-model="form.llm_model" name="llm_model" autocomplete="off" />
          </el-form-item>

          <el-form-item label="LLM 接口地址">
            <el-input
              v-model="form.llm_base_url"
              name="llm_base_url"
              type="url"
              inputmode="url"
              autocomplete="off"
              placeholder="例如：https://api.example.com/v1…"
            />
          </el-form-item>

          <el-form-item label="LLM 密钥">
            <el-input
              v-model="form.llm_api_key"
              name="llm_api_key"
              type="password"
              show-password
              autocomplete="new-password"
              placeholder="请输入 LLM 密钥"
              @input="markLlmApiKeyTouched"
            />
            <div class="setting-note">
              <el-tag size="small" :type="llmApiKeyConfigured ? 'success' : 'info'">
                {{ llmApiKeyConfigured ? "当前已配置" : "尚未配置" }}
              </el-tag>
              <span class="secondary-text">留空则保持当前配置不变。</span>
            </div>
            <div class="setting-actions">
              <el-button
                type="primary"
                plain
                size="small"
                :icon="configStore.llmStatus.status === 'checking' ? Loading : undefined"
                :loading="configStore.llmStatus.status === 'checking'"
                :disabled="!canEdit"
                @click="runLlmCheck"
              >
                测试 LLM
              </el-button>
              <span v-if="configStore.llmStatus.checkedAt" class="secondary-text">
                最近检测：{{ formatDateTime(configStore.llmStatus.checkedAt) }}
              </span>
            </div>
          </el-form-item>
        </section>

        <section class="settings-section">
          <div class="settings-section__header">
            <div>
              <p class="panel-eyebrow">Embedding</p>
              <h4>向量与语义能力</h4>
            </div>
            <span class="secondary-text">影响相似度、检索和语义关联等后续流程。</span>
          </div>

          <el-form-item>
            <el-select
              v-model="form.embedding_provider"
              placeholder="请选择 Embedding 提供方"
              style="width: 100%"
            >
              <el-option
                v-for="option in embeddingProviderOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <template #label>
              <span class="setting-label">
                <span>Embedding 提供方</span>
                <el-tooltip :content="embeddingProviderHint" effect="dark" placement="top" :show-after="150">
                  <el-icon class="setting-label__hint"><InfoFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
          </el-form-item>

          <el-form-item label="Embedding 模型">
            <el-input v-model="form.embedding_model" name="embedding_model" autocomplete="off" />
          </el-form-item>

          <el-form-item label="Embedding 接口地址">
            <el-input
              v-model="form.embedding_base_url"
              name="embedding_base_url"
              type="url"
              inputmode="url"
              autocomplete="off"
              placeholder="例如：https://api.example.com/v1…"
            />
          </el-form-item>

          <el-form-item label="Embedding 密钥">
            <el-input
              v-model="form.embedding_api_key"
              name="embedding_api_key"
              type="password"
              show-password
              autocomplete="new-password"
              placeholder="请输入 Embedding 密钥"
              @input="markEmbeddingApiKeyTouched"
            />
            <div class="setting-note">
              <el-tag size="small" :type="embeddingApiKeyConfigured ? 'success' : 'info'">
                {{ embeddingApiKeyConfigured ? "当前已配置" : "尚未配置" }}
              </el-tag>
              <span class="secondary-text">留空则保持当前配置不变。</span>
            </div>
            <div class="setting-actions">
              <el-button
                type="primary"
                plain
                size="small"
                :icon="configStore.embeddingStatus.status === 'checking' ? Loading : undefined"
                :loading="configStore.embeddingStatus.status === 'checking'"
                :disabled="!canEdit"
                @click="runEmbeddingCheck"
              >
                测试 Embedding
              </el-button>
              <span v-if="configStore.embeddingStatus.checkedAt" class="secondary-text">
                最近检测：{{ formatDateTime(configStore.embeddingStatus.checkedAt) }}
              </span>
            </div>
          </el-form-item>
        </section>

        <section class="settings-section">
          <div class="settings-section__header">
            <div>
              <p class="panel-eyebrow">Concurrency</p>
              <h4>任务并发</h4>
            </div>
            <span class="secondary-text">为抓取、LLM 和 Embedding 阶段分别设置执行强度。</span>
          </div>

          <el-form-item label="抓取并发数">
            <el-input-number v-model="form.fetch_concurrency" :min="1" :step="1" style="width: 100%" />
          </el-form-item>

          <el-form-item label="LLM 并发数">
            <el-input-number v-model="form.llm_concurrency" :min="1" :step="1" style="width: 100%" />
          </el-form-item>

          <el-form-item label="Embedding 并发数">
            <el-input-number v-model="form.embedding_concurrency" :min="1" :step="1" style="width: 100%" />
          </el-form-item>
        </section>
      </el-form>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="requestClose">关闭</el-button>
        <el-button type="primary" :loading="configStore.saving" :disabled="!canEdit" @click="save">
          保存基础配置
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.settings-workbench {
  display: grid;
  gap: 16px;
}

.settings-workbench :deep(.el-form-item) {
  margin-bottom: 18px;
}

.settings-hero,
.settings-summary-card,
.settings-section {
  border: 1px solid rgba(103, 121, 103, 0.12);
  border-radius: 18px;
  background: rgba(255, 252, 245, 0.94);
  padding: 16px;
  box-shadow: 0 10px 24px rgba(62, 74, 59, 0.06);
}

.settings-hero {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 248, 238, 0.92)),
    rgba(255, 252, 245, 0.94);
}

.settings-hero h3,
.settings-section h4 {
  margin: 0;
  color: #223329;
}

.settings-hero :deep(.el-tag) {
  border-color: rgba(31, 122, 90, 0.18);
  background: rgba(247, 251, 246, 0.96);
  color: #275841;
}

.settings-summary-card {
  display: grid;
  gap: 6px;
  background: rgba(250, 245, 236, 0.96);
}

.settings-summary-card__label {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.settings-status-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.settings-form {
  display: grid;
  gap: 16px;
}

.settings-section {
  display: grid;
  gap: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(252, 247, 240, 0.95)),
    rgba(255, 252, 245, 0.94);
}

.settings-section__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.setting-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #324536;
  font-weight: 600;
}

.setting-label__hint {
  color: #7b877c;
  cursor: help;
  font-size: 14px;
}

.setting-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.setting-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.desktop-shortcut-row {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.settings-workbench :deep(.el-input__wrapper),
.settings-workbench :deep(.el-textarea__inner),
.settings-workbench :deep(.el-input-number .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 1px rgba(104, 121, 104, 0.12) inset;
}

.settings-workbench :deep(.el-input-group__append) {
  background: rgba(248, 242, 231, 0.98);
  color: #334737;
  border-color: rgba(103, 121, 103, 0.12);
}

.settings-workbench :deep(.el-button--default) {
  border-color: rgba(103, 121, 103, 0.14);
  background: rgba(255, 255, 255, 0.9);
  color: #314437;
}

.settings-workbench :deep(.el-button--primary.is-plain) {
  border-color: rgba(31, 122, 90, 0.22);
  background: rgba(243, 249, 245, 0.98);
  color: #1f7a5a;
}

.settings-workbench :deep(.el-tag--info) {
  border-color: rgba(123, 135, 124, 0.18);
  background: rgba(250, 248, 242, 0.96);
  color: #667566;
}

.settings-workbench :deep(.el-tag--success) {
  border-color: rgba(31, 122, 90, 0.2);
  background: rgba(241, 249, 244, 0.98);
  color: #1f7a5a;
}

:deep(.settings-drawer .el-drawer__header),
:deep(.settings-drawer .el-drawer__body),
:deep(.settings-drawer .el-drawer__footer) {
  background:
    radial-gradient(circle at top right, rgba(240, 219, 186, 0.18), transparent 28%),
    linear-gradient(180deg, rgba(250, 245, 236, 0.98), rgba(245, 237, 224, 0.98));
}

@media (max-width: 640px) {
  .desktop-shortcut-row {
    grid-template-columns: 1fr;
  }
}
</style>
