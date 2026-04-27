<script setup lang="ts">
import { reactive, watch } from "vue";
import { FolderOpened } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";

import { chooseDirectory, hasDirectoryPicker } from "@/services/desktop-bridge";
import { useNoticesStore } from "@/stores/notices";
import { useWebSessionProfilesStore } from "@/stores/webSessionProfiles";

const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{
  select: [profileId: string | null];
}>();

const webSessionProfilesStore = useWebSessionProfilesStore();
const noticesStore = useNoticesStore();
const supportsDirectoryPicker = hasDirectoryPicker();

const sessionForm = reactive({
  name: "",
  mode: "browser_profile" as "browser_profile" | "app_session",
  browser_channel: "chromium",
  profile_path: "",
  login_url: ""
});

const browserProfileTips = [
  "可在 chrome://version 或 edge://version 查看 Profile Path。",
  "通常填写 Profile Path 的上一级 User Data 目录，而不是里面的 Default 或 Profile 3。",
  "Chrome 常见目录：C:\\Users\\用户名\\AppData\\Local\\Google\\Chrome\\User Data",
  "Edge 常见目录：C:\\Users\\用户名\\AppData\\Local\\Microsoft\\Edge\\User Data"
];

const resetSessionForm = () => {
  sessionForm.name = "";
  sessionForm.mode = "browser_profile";
  sessionForm.browser_channel = "chromium";
  sessionForm.profile_path = "";
  sessionForm.login_url = "";
};

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

const pickProfileDirectory = async () => {
  const selected = await chooseDirectory({ title: "选择浏览器用户数据目录" });
  if (selected) {
    sessionForm.profile_path = selected;
  }
};

const createSessionProfile = async () => {
  try {
    const created = await webSessionProfilesStore.createProfile({
      name: sessionForm.name,
      mode: sessionForm.mode,
      browser_channel: sessionForm.browser_channel,
      profile_path:
        sessionForm.mode === "browser_profile"
          ? sessionForm.profile_path || null
          : null,
      login_url: sessionForm.login_url || null
    });
    emit("select", created.id);
    resetSessionForm();
    noticesStore.push({
      kind: "success",
      title: "会话已创建",
      message:
        created.mode === "app_session"
          ? "可以继续打开登录窗口并保存会话。"
          : "该会话已可用于网页抓取。"
    });
  } catch {
    noticesStore.push({
      kind: "error",
      title: "创建会话失败",
      message: webSessionProfilesStore.error ?? "请稍后重试。"
    });
  }
};

const loginWithProfile = async (profileId: string) => {
  const profile = webSessionProfilesStore.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return;
  }
  try {
    await webSessionProfilesStore.startManagedLogin(profileId, profile.login_url ?? null);
    noticesStore.push({
      kind: "success",
      title: "登录态已保存",
      message: "关闭登录窗口后，会话目录已经更新。"
    });
  } catch {
    noticesStore.push({
      kind: "error",
      title: "登录窗口启动失败",
      message: webSessionProfilesStore.error ?? "请稍后重试。"
    });
  }
};

const removeProfile = async (profileId: string) => {
  try {
    await ElMessageBox.confirm(
      "删除后，这个网页登录会话不会再出现在抓取会话列表中。",
      "删除网页登录会话？",
      {
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        type: "warning",
        confirmButtonClass: "el-button--danger"
      }
    );
  } catch {
    return;
  }

  try {
    await webSessionProfilesStore.deleteProfile(profileId);
    noticesStore.push({
      kind: "success",
      title: "会话已删除",
      message: "该网页登录会话已从当前配置中移除。"
    });
  } catch {
    noticesStore.push({
      kind: "error",
      title: "删除会话失败",
      message: webSessionProfilesStore.error ?? "请稍后重试。"
    });
  }
};

watch(open, (visible) => {
  if (visible) {
    void loadProfiles();
  }
});
</script>

<template>
  <el-drawer
    v-model="open"
    title="网页登录会话"
    direction="rtl"
    size="560px"
    destroy-on-close
    class="web-session-dialog"
  >
    <div class="web-session-dialog__body">
      <section class="surface-card web-session-dialog__section">
        <div class="web-session-dialog__section-header">
          <div>
            <p class="panel-eyebrow">Saved Sessions</p>
            <h3>已有会话</h3>
          </div>
          <el-button
            plain
            size="small"
            :loading="webSessionProfilesStore.loading"
            @click="loadProfiles"
          >
            刷新
          </el-button>
        </div>

        <div
          v-if="webSessionProfilesStore.profiles.length"
          class="web-session-dialog__list"
        >
          <article
            v-for="profile in webSessionProfilesStore.profiles"
            :key="profile.id"
            class="web-session-dialog__item"
          >
            <div class="web-session-dialog__item-main">
              <strong>{{ profile.name }}</strong>
              <span class="secondary-text">
                {{
                  profile.mode === "browser_profile"
                    ? "复用本机浏览器 Profile"
                    : "应用内 Playwright 会话"
                }}
              </span>
              <span class="secondary-text">{{ profile.status_detail }}</span>
            </div>
            <div class="web-session-dialog__item-meta">
              <el-tag size="small" effect="plain">{{ profile.browser_channel }}</el-tag>
              <el-tag
                size="small"
                effect="plain"
                :type="
                  profile.status === 'ready'
                    ? 'success'
                    : profile.status === 'needs_login'
                      ? 'warning'
                      : 'danger'
                "
              >
                {{ profile.status }}
              </el-tag>
            </div>
            <div class="web-session-dialog__item-actions">
              <el-button plain size="small" @click="emit('select', profile.id)">
                使用
              </el-button>
              <el-button
                v-if="profile.mode === 'app_session'"
                plain
                size="small"
                :loading="webSessionProfilesStore.loggingInProfileId === profile.id"
                @click="loginWithProfile(profile.id)"
              >
                打开登录窗口
              </el-button>
              <el-button
                plain
                size="small"
                type="danger"
                :loading="webSessionProfilesStore.deletingProfileId === profile.id"
                @click="removeProfile(profile.id)"
              >
                删除
              </el-button>
            </div>
          </article>
        </div>
        <p v-else class="secondary-text">还没有已保存的网页登录会话。</p>
      </section>

      <section class="surface-card web-session-dialog__section">
        <div class="web-session-dialog__section-header">
          <div>
            <p class="panel-eyebrow">New Session</p>
            <h3>创建会话</h3>
          </div>
        </div>

        <el-form label-position="top">
          <el-form-item label="会话名称">
            <el-input
              v-model="sessionForm.name"
              data-testid="session-name"
              name="session-name"
              autocomplete="off"
              placeholder="例如：知乎已登录"
            />
          </el-form-item>
          <el-form-item label="会话类型">
            <el-select
              v-model="sessionForm.mode"
              data-testid="session-mode"
              style="width: 100%"
            >
              <el-option label="复用本机浏览器 Profile" value="browser_profile" />
              <el-option label="应用内 Playwright 会话" value="app_session" />
            </el-select>
          </el-form-item>
          <el-form-item label="浏览器通道">
            <el-select
              v-model="sessionForm.browser_channel"
              data-testid="session-browser-channel"
              style="width: 100%"
            >
              <el-option label="Chromium" value="chromium" />
              <el-option label="Chrome" value="chrome" />
              <el-option label="Edge" value="msedge" />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="sessionForm.mode === 'browser_profile'"
            label="浏览器用户数据目录"
          >
            <el-input
              v-model="sessionForm.profile_path"
              data-testid="session-profile-path"
              name="session-profile-path"
              autocomplete="off"
              placeholder="例如：C:\\Users\\you\\AppData\\Local\\Google\\Chrome\\User Data"
            >
              <template v-if="supportsDirectoryPicker" #append>
                <el-button
                  :icon="FolderOpened"
                  aria-label="选择浏览器用户数据目录"
                  @click="pickProfileDirectory"
                />
              </template>
            </el-input>
            <div class="web-session-dialog__tips" data-testid="session-profile-path-tip">
              <p
                v-for="tip in browserProfileTips"
                :key="tip"
                class="secondary-text web-session-dialog__tip"
              >
                {{ tip }}
              </p>
            </div>
          </el-form-item>
          <el-form-item label="登录页网址">
            <el-input
              v-model="sessionForm.login_url"
              data-testid="session-login-url"
              name="session-login-url"
              type="url"
              inputmode="url"
              autocomplete="off"
              placeholder="例如：https://example.com/login"
            />
          </el-form-item>
        </el-form>

        <div class="web-session-dialog__create-actions">
          <span class="secondary-text">
            应用内会话创建后，可直接打开登录窗口并保存会话。
          </span>
          <el-button
            type="primary"
            :loading="webSessionProfilesStore.saving"
            @click="createSessionProfile"
          >
            创建会话
          </el-button>
        </div>
      </section>
    </div>
  </el-drawer>
</template>

<style scoped>
.web-session-dialog :deep(.el-drawer__body) {
  padding: 14px;
  overflow: auto;
}

.web-session-dialog__body,
.web-session-dialog__section,
.web-session-dialog__list {
  display: grid;
  gap: 12px;
}

.web-session-dialog__section {
  padding: 14px;
}

.web-session-dialog__section-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.web-session-dialog__section-header h3 {
  margin: 2px 0 0;
  font-size: 16px;
}

.web-session-dialog__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}

.web-session-dialog__item-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.web-session-dialog__item-meta,
.web-session-dialog__item-actions,
.web-session-dialog__create-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.web-session-dialog__create-actions {
  justify-content: space-between;
}

.web-session-dialog__tips {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

.web-session-dialog__tip {
  line-height: 1.5;
}

@media (max-width: 760px) {
  .web-session-dialog :deep(.el-drawer) {
    width: min(100vw, 560px) !important;
  }

  .web-session-dialog__item {
    grid-template-columns: 1fr;
  }
}
</style>
