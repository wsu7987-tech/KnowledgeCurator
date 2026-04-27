<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from "vue";
import { RouterView, useRoute } from "vue-router";

import AppShell from "@/components/AppShell.vue";
import SettingsDrawer from "@/components/SettingsDrawer.vue";
import { useConfigStore } from "@/stores/config";
import { useNoticesStore } from "@/stores/notices";

const noticesStore = useNoticesStore();
const configStore = useConfigStore();
const route = useRoute();
const settingsOpen = ref(false);
const notices = computed(() => noticesStore.items);
const isQuickCaptureRoute = computed(() => route.name === "quick-capture");
const isPoolQuickCaptureMode = computed(
  () => route.name === "pool" && route.query.mode === "quick-capture"
);
const isShelllessRoute = computed(() => isQuickCaptureRoute.value || isPoolQuickCaptureMode.value);

watchEffect(() => {
  if (typeof document === "undefined") {
    return;
  }

  document.body.classList.toggle("shellless-route", isShelllessRoute.value);
});

onBeforeUnmount(() => {
  if (typeof document === "undefined") {
    return;
  }

  document.body.classList.remove("shellless-route");
});

onMounted(() => {
  void configStore.probeGenerationCapabilities();
});
</script>

<template>
  <div
    v-if="!isShelllessRoute && notices.length"
    class="notice-tray"
    role="status"
    aria-live="polite"
    aria-atomic="false"
  >
    <el-alert
      v-for="notice in notices"
      :key="notice.id"
      :title="notice.title"
      :description="notice.message"
      :type="notice.kind"
      show-icon
      @close="noticesStore.remove(notice.id)"
    />
  </div>

  <RouterView v-if="isShelllessRoute" />

  <AppShell v-else @open-settings="settingsOpen = true">
    <RouterView />
  </AppShell>

  <SettingsDrawer v-if="!isShelllessRoute" v-model:open="settingsOpen" />
</template>
