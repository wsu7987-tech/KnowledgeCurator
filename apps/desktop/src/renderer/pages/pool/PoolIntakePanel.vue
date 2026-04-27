<script setup lang="ts">
import PoolEntryMarkdownForm from "./PoolEntryMarkdownForm.vue";
import PoolEntryPdfForm from "./PoolEntryPdfForm.vue";
import PoolEntryTextForm from "./PoolEntryTextForm.vue";
import PoolEntryUrlForm from "./PoolEntryUrlForm.vue";
import WebSessionManagerDialog from "./WebSessionManagerDialog.vue";
import { usePoolContext } from "./usePoolContext";

const pool = usePoolContext();
</script>

<template>
  <section class="surface-card pool-intake">
    <div class="pool-intake__header">
      <div>
       
        <h2>添加来源</h2>
      </div>
      <el-button
        data-testid="quick-capture-toggle"
        plain
        size="small"
        @click="pool.toggleQuickCaptureMode"
      >
        {{ pool.quickCaptureMode ? "退出" : "快速集采模式" }}
      </el-button>
    </div>

    <div class="pool-entry-form">
      <el-segmented v-model="pool.activeSourceType" :options="pool.sourceOptions" />

      <PoolEntryUrlForm
        v-show="pool.activeSourceType === 'url'"
        :ref="pool.setUrlFormRef"
        @manage-sessions="pool.sessionManagerOpen = true"
      />
      <PoolEntryPdfForm
        v-show="pool.activeSourceType === 'pdf'"
        :ref="pool.setPdfFormRef"
      />
      <PoolEntryMarkdownForm
        v-show="pool.activeSourceType === 'markdown'"
        :ref="pool.setMarkdownFormRef"
      />
      <PoolEntryTextForm
        v-show="pool.activeSourceType === 'text'"
        :ref="pool.setTextFormRef"
      />
    </div>

    <div class="pool-intake__actions">
      <el-button
        type="primary"
        :loading="pool.primaryActionLoading"
        @click="pool.submitActiveEntry"
      >
        {{ pool.primaryActionLabel }}
      </el-button>
    </div>

    <WebSessionManagerDialog
      v-model="pool.sessionManagerOpen"
      @select="pool.selectSessionProfile"
    />
  </section>
</template>

<style scoped>
.pool-intake {
  display: grid;
  gap: 14px;
}

.pool-intake__header,
.pool-intake__actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.pool-intake__header h2 {
  margin: 2px 0 0;
  font-size: 18px;
}

.pool-entry-form {
  display: grid;
  gap: 14px;
}

.pool-entry-form :deep(.el-segmented) {
  width: 100%;
}

.pool-entry-form :deep(.el-segmented__group) {
  flex-wrap: wrap;
}
</style>
