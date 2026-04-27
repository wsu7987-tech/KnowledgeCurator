<script setup lang="ts">
import { computed, reactive } from "vue";
import { Files } from "@element-plus/icons-vue";

import type { PoolEntryFormExpose } from "./pool-entry-form";
import EndpointNotice from "@/components/EndpointNotice.vue";
import { chooseFile, hasFilePicker } from "@/services/desktop-bridge";
import { useNoticesStore } from "@/stores/notices";
import { usePdfDraftStore } from "@/stores/pdfDraft";

const pdfDraftStore = usePdfDraftStore();
const noticesStore = useNoticesStore();

const form = reactive({
  source_value: "",
  title: ""
});

const supportsFilePicker = computed(() => hasFilePicker());

const reset = () => {
  form.source_value = "";
  form.title = "";
};

const pickFile = async () => {
  if (!supportsFilePicker.value) {
    noticesStore.push({
      kind: "info",
      title: "当前环境无法打开文件选择器",
      message: "请在 Electron 桌面端使用“选择文件”按钮，或直接填写本地路径。"
    });
    return;
  }

  const selected = await chooseFile({
    title: "选择 PDF 文件",
    filters: [{ name: "PDF 文件", extensions: ["pdf"] }]
  });

  if (!selected) {
    noticesStore.push({
      kind: "info",
      title: "未选择文件",
      message: "这次没有选择任何文件。"
    });
    return;
  }

  form.source_value = selected;
  noticesStore.push({
    kind: "success",
    title: "文件已选中",
    message: "文件路径已填入来源输入框。"
  });
};

const submit = async () => {
  const filePath = form.source_value.trim();
  if (!filePath) {
    noticesStore.push({
      kind: "warning",
      title: "请先填写来源信息",
      message: "PDF 文件路径不能为空。"
    });
    return false;
  }

  try {
    await pdfDraftStore.createDraft({
      file_path: filePath,
      title: form.title.trim() || null
    });
    noticesStore.push({
      kind: "success",
      title: "PDF 解析任务已启动",
      message: "可以在下方任务卡片里查看进度，完成后再保存结果并加入总结池。"
    });
    reset();
    return true;
  } catch {
    noticesStore.push({
      kind: "error",
      title: "PDF 解析失败",
      message: pdfDraftStore.error ?? "请检查文件路径后重试。"
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
    <el-form-item label="PDF 文件">
      <el-input
        v-model="form.source_value"
        data-testid="pdf-source"
        name="pdf-source"
        autocomplete="off"
        placeholder="请选择 PDF 文件，或手动输入本地路径"
      >
        <template #append>
          <el-button :icon="Files" @click="pickFile">选择 PDF 文件</el-button>
        </template>
      </el-input>
      <p class="secondary-text">
        PDF 先解析预览；保存当前结果后，才能加入总结池。
      </p>
      <EndpointNotice
        v-if="!supportsFilePicker"
        type="info"
        title="当前环境无法打开文件选择器"
        detail="请在 Electron 桌面端使用“选择文件”按钮，或直接填写本地路径。"
      />
    </el-form-item>
    <el-form-item label="显示标题">
      <el-input
        v-model="form.title"
        data-testid="pdf-title"
        name="pdf-title"
        autocomplete="off"
        placeholder="可选：补充更易读的标题"
      />
    </el-form-item>
  </el-form>
</template>
