<script setup lang="ts">
import { computed, onMounted, reactive, watch } from "vue";

import type { PoolEntryFormExpose } from "./pool-entry-form";
import { useNoticesStore } from "@/stores/notices";
import { useWebDraftStore } from "@/stores/webDraft";
import { useWebSessionProfilesStore } from "@/stores/webSessionProfiles";

type UrlFormExpose = PoolEntryFormExpose & {
  selectSessionProfile: (profileId: string | null) => void;
};

const emit = defineEmits<{
  manageSessions: [];
}>();

const webDraftStore = useWebDraftStore();
const webSessionProfilesStore = useWebSessionProfilesStore();
const noticesStore = useNoticesStore();

const form = reactive({
  source_value: "",
  title: "",
  session_profile_id: null as string | null
});

const activeSessionProfile = computed(
  () =>
    webSessionProfilesStore.profiles.find(
      (item) => item.id === form.session_profile_id
    ) ?? null
);

const loadProfiles = async () => {
  try {
    await webSessionProfilesStore.loadProfiles();
  } catch {
    noticesStore.push({
      kind: "warning",
      title: "会话列表加载失败",
      message: webSessionProfilesStore.error ?? "请稍后重试。"
    });
  }
};

const reset = () => {
  form.source_value = "";
  form.title = "";
};

const selectSessionProfile = (profileId: string | null) => {
  form.session_profile_id = profileId;
};

const submit = async () => {
  const sourceValue = form.source_value.trim();
  if (!sourceValue) {
    noticesStore.push({
      kind: "warning",
      title: "请先填写来源信息",
      message: "网页链接不能为空。"
    });
    return false;
  }

  try {
    await webDraftStore.createDraft({
      url: sourceValue,
      title: form.title.trim() || null,
      session_profile_id: form.session_profile_id
    });
    noticesStore.push({
      kind: "success",
      title: "已开始抓取预览",
      message: "网页内容正在解析，完成后可保存版本并加入总结池。"
    });
    reset();
    return true;
  } catch {
    noticesStore.push({
      kind: "error",
      title: "解析失败",
      message: webDraftStore.error ?? "请检查网址后重试。"
    });
    return false;
  }
};

onMounted(() => {
  void loadProfiles();
});

watch(
  () => webSessionProfilesStore.profiles,
  (profiles) => {
    if (
      form.session_profile_id &&
      !profiles.some((item) => item.id === form.session_profile_id)
    ) {
      form.session_profile_id = null;
    }
  },
  { deep: true }
);

defineExpose<UrlFormExpose>({
  reset,
  submit,
  selectSessionProfile
});
</script>

<template>
  <div class="pool-url-form">
    <el-form label-position="top">
      <el-form-item label="网页链接">
        <el-input
          v-model="form.source_value"
          data-testid="url-source"
          name="url-source"
          type="url"
          inputmode="url"
          autocomplete="off"
          placeholder="https://example.com/article"
        />
        <p class="secondary-text tip">填写需要抓取并预览的网页地址。</p>
      </el-form-item>

      <el-form-item label="显示标题">
        <el-input
          v-model="form.title"
          data-testid="url-title"
          name="url-title"
          autocomplete="off"
          placeholder="可选：补充更易读的标题"
        />
      </el-form-item>

      <el-form-item label="登录会话">
        <el-select
          v-model="form.session_profile_id"
          data-testid="url-session-select"
          clearable
          placeholder="匿名抓取（默认）"
          style="width: 100%"
        >
          <el-option label="匿名抓取（默认）" :value="null" />
          <el-option
            v-for="profile in webSessionProfilesStore.profiles"
            :key="profile.id"
            :label="`${profile.name} · ${profile.mode === 'browser_profile' ? '浏览器 Profile' : '应用内会话'} · ${profile.status}`"
            :value="profile.id"
          />
        </el-select>
        <div class="pool-url-form__session-actions">
          <span class="secondary-text tip">
            {{
              activeSessionProfile?.status_detail ??
              "抓取需要登录的页面时，再选择或创建会话。"
            }}
          </span>
          <el-button plain size="small" @click="emit('manageSessions')">
            管理会话
          </el-button>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.pool-url-form {
  display: grid;
  gap: 0;
}

.pool-url-form__session-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
  flex-wrap: wrap;
}
.tip {
  margin: 0;
  font-size: 10px;
}
</style>
