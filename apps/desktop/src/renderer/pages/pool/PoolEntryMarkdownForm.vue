<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { Files } from "@element-plus/icons-vue";

import type { PoolEntryFormExpose } from "./pool-entry-form";
import EndpointNotice from "@/components/EndpointNotice.vue";
import PoolMetadataFields from "@/components/PoolMetadataFields.vue";
import { chooseFile, hasFilePicker } from "@/services/desktop-bridge";
import { api } from "@/services/api";
import { useNoticesStore } from "@/stores/notices";
import { usePoolStore } from "@/stores/pool";

const labels = {
  pickFileUnavailableTitle: "\u5f53\u524d\u73af\u5883\u65e0\u6cd5\u6253\u5f00\u6587\u4ef6\u9009\u62e9\u5668",
  pickFileUnavailableDetail:
    "\u8bf7\u5728 Electron \u684c\u9762\u7aef\u4f7f\u7528\u201c\u9009\u62e9\u6587\u4ef6\u201d\u6309\u94ae\uff0c\u6216\u76f4\u63a5\u586b\u5199\u672c\u5730\u8def\u5f84\u3002",
  fileSelectedTitle: "\u6587\u4ef6\u5df2\u9009\u4e2d",
  fileSelectedMessage: "\u6587\u4ef6\u8def\u5f84\u5df2\u586b\u5165\u6765\u6e90\u8f93\u5165\u6846\u3002",
  fileUnselectedTitle: "\u672a\u9009\u62e9\u6587\u4ef6",
  fileUnselectedMessage: "\u8fd9\u6b21\u6ca1\u6709\u9009\u62e9\u4efb\u4f55\u6587\u4ef6\u3002",
  missingSourceTitle: "\u8bf7\u5148\u586b\u5199\u6765\u6e90\u4fe1\u606f",
  missingSourceMessage: "Markdown \u6587\u4ef6\u8def\u5f84\u4e0d\u80fd\u4e3a\u7a7a\u3002",
  addedTitle: "\u5df2\u52a0\u5165\u603b\u7ed3\u6c60",
  addedMessage: "\u65b0\u6761\u76ee\u5df2\u53ef\u7528\u4e8e\u540e\u7eed\u603b\u7ed3\u3002",
  addFailedTitle: "\u6dfb\u52a0\u5931\u8d25",
  metadataSuggestedTitle: "\u5df2\u751f\u6210 AI \u5efa\u8bae\u6807\u8bb0",
  metadataSuggestedMessage: "\u5df2\u586b\u5165\u5efa\u8bae\u5206\u7c7b\u548c\u6807\u7b7e\uff0c\u4f60\u53ef\u4ee5\u7ee7\u7eed\u4fee\u6539\u3002",
  metadataSuggestFailedTitle: "\u5efa\u8bae\u6807\u8bb0\u5931\u8d25"
} as const;

const poolStore = usePoolStore();
const noticesStore = useNoticesStore();

const form = reactive({
  source_value: "",
  title: "",
  raw_text: "",
  category: "",
  tags: [] as string[]
});
const suggestingMetadata = ref(false);

const supportsFilePicker = computed(() => hasFilePicker());

const reset = () => {
  form.source_value = "";
  form.title = "";
  form.raw_text = "";
  form.category = "";
  form.tags = [];
};

const pickFile = async () => {
  if (!supportsFilePicker.value) {
    noticesStore.push({
      kind: "info",
      title: labels.pickFileUnavailableTitle,
      message: labels.pickFileUnavailableDetail
    });
    return;
  }

  const selected = await chooseFile({
    title: "\u9009\u62e9 Markdown \u6587\u4ef6",
    filters: [{ name: "Markdown \u6587\u4ef6", extensions: ["md", "markdown", "txt"] }]
  });

  if (selected) {
    form.source_value = selected;
    noticesStore.push({
      kind: "success",
      title: labels.fileSelectedTitle,
      message: labels.fileSelectedMessage
    });
    return;
  }

  noticesStore.push({
    kind: "info",
    title: labels.fileUnselectedTitle,
    message: labels.fileUnselectedMessage
  });
};

const suggestMetadata = async () => {
  suggestingMetadata.value = true;
  try {
    const suggestion = await api.suggestPoolMetadata({
      source_type: "markdown",
      source_value: form.source_value.trim(),
      title: form.title.trim() || null,
      raw_text: form.raw_text.trim() || null
    });
    form.category = suggestion.category;
    form.tags = [...suggestion.tags];
    noticesStore.push({
      kind: "success",
      title: labels.metadataSuggestedTitle,
      message: labels.metadataSuggestedMessage
    });
  } catch (errorValue) {
    noticesStore.push({
      kind: "error",
      title: labels.metadataSuggestFailedTitle,
      message: (errorValue as Error).message
    });
  } finally {
    suggestingMetadata.value = false;
  }
};

const submit = async () => {
  const sourceValue = form.source_value.trim();
  if (!sourceValue) {
    noticesStore.push({
      kind: "warning",
      title: labels.missingSourceTitle,
      message: labels.missingSourceMessage
    });
    return false;
  }

  try {
    await poolStore.addItem({
      source_type: "markdown",
      source_value: sourceValue,
      title: form.title.trim() || null,
      raw_text: form.raw_text.trim() || null,
      category: form.category.trim() || null,
      tags: [...form.tags]
    });
    noticesStore.push({
      kind: "success",
      title: labels.addedTitle,
      message: labels.addedMessage
    });
    reset();
    return true;
  } catch {
    noticesStore.push({
      kind: "error",
      title: labels.addFailedTitle,
      message: poolStore.error ?? "\u8bf7\u68c0\u67e5\u8f93\u5165\u5185\u5bb9\u540e\u91cd\u8bd5\u3002"
    });
    return false;
  }
};

defineExpose<PoolEntryFormExpose>({
  reset,
  submit
});
</script>

<template>
  <el-form label-position="top">
    <el-form-item label="Markdown 文件">
      <el-input
        v-model="form.source_value"
        data-testid="markdown-source"
        name="markdown-source"
        autocomplete="off"
        placeholder="请选择 Markdown 文件，或手动输入本地路径…"
      >
        <template #append>
          <el-button :icon="Files" @click="pickFile">选择 Markdown 文件</el-button>
        </template>
      </el-input>
      <p class="secondary-text">支持 .md / .markdown 文件，也可以手动粘贴路径。</p>
      <EndpointNotice
        v-if="!supportsFilePicker"
        type="info"
        :title="labels.pickFileUnavailableTitle"
        :detail="labels.pickFileUnavailableDetail"
      />
    </el-form-item>

    <el-form-item label="显示标题">
      <el-input
        v-model="form.title"
        data-testid="markdown-title"
        name="markdown-title"
        autocomplete="off"
        placeholder="可选：补充更易读的标题…"
      />
    </el-form-item>

    <PoolMetadataFields
      test-id-prefix="markdown"
      :category="form.category"
      :tags="form.tags"
      :suggest-loading="suggestingMetadata"
      @update:category="form.category = $event"
      @update:tags="form.tags = $event"
      @suggest="suggestMetadata"
    />

    <el-form-item label="Markdown 内容（可直接粘贴）">
      <el-input
        v-model="form.raw_text"
        data-testid="markdown-raw"
        type="textarea"
        :rows="5"
        name="markdown-raw"
        autocomplete="off"
        placeholder="可直接粘贴 Markdown 正文，或在文件路径之外补充内容…"
      />
    </el-form-item>
  </el-form>
</template>
