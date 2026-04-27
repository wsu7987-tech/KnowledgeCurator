<script setup lang="ts">
import { ChatDotRound, Plus, Delete, Position } from '@element-plus/icons-vue'

import { useQaCenterContext } from "./useQaCenterContext";

const qa = useQaCenterContext();
</script>

<template>
  <section class="qa-question">
    <div class="qa-question__container">
      <!-- 顶部工具栏：会话状态 + 新会话按钮 -->
      <div class="qa-question__toolbar">
        <div class="qa-question__session-info">
          <el-icon class="session-icon"><ChatDotRound /></el-icon>
          <span class="session-status">
            {{ qa.qaStore.selectedSessionId ? "继续当前会话" : "创建新会话" }}
          </span>
        </div>
        <el-button
          plain
          size="small"
          class="new-session-btn"
          data-testid="qa-new-session-button"
          @click="qa.startNewSession"
        >
          <el-icon><Plus /></el-icon>
          <span>新会话</span>
        </el-button>
      </div>

      <!-- 输入区容器：模仿 DeepSeek 卡片式输入框 -->
      <div class="qa-question__input-area">
        <el-input
          v-model="qa.question"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 8 }"
          placeholder="输入问题，例如：这批资料里关于向量数据库选型的核心结论是什么？…"
          class="qa-question__textarea"
          aria-label="输入问答问题"
          name="qa-question"
          autocomplete="off"
        />
        
        <!-- 底部操作栏：附加控制 + 发送/清空按钮 -->
        <div class="qa-question__actions">
          <div class="qa-question__action-left">
            <!-- 预留扩展位：未来可加入联网搜索、深度思考等开关 -->
            <span class="input-hint">Enter 发送 / Shift+Enter 换行</span>
          </div>
          <div class="qa-question__action-right">
            <el-button
              size="small"
              plain
              class="clear-btn"
              @click="qa.question = ''"
            >
              <el-icon><Delete /></el-icon>
              <span>清空</span>
            </el-button>
            <el-button
              type="primary"
              size="small"
              class="send-btn"
              :loading="qa.qaStore.loading"
              :disabled="!qa.generationReady"
              @click="qa.submitQuestion"
            >
              <el-icon v-if="!qa.qaStore.loading"><Position /></el-icon>
              <span>{{ qa.qaStore.loading ? '发送中' : '发送' }}</span>
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>



<style scoped>
/* ========== 容器与整体布局 ========== */
.qa-question {
  width: 100%;
  background: transparent;
}

.qa-question__container {
  max-width: 900px;
  margin: 0 auto;
}

/* ========== 顶部工具栏 ========== */
.qa-question__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 4px;
}

.qa-question__session-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary, #6b7280);
}

.session-icon {
  font-size: 16px;
  color: var(--el-color-primary, #409eff);
}

.session-status {
  font-weight: 450;
  letter-spacing: 0.3px;
}

.new-session-btn {
  border-radius: 20px !important;
  padding: 6px 12px !important;
  font-weight: 500;
  transition: all 0.2s ease;
}

.new-session-btn:hover {
  background-color: var(--el-fill-color-light, #f5f7fa);
  transform: translateY(-1px);
}

/* ========== 输入区域 (类似DeepSeek卡片) ========== */
.qa-question__input-area {
  background-color: var(--el-bg-color, #ffffff);
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.02);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  border: 1px solid var(--el-border-color-light, #e4e7ed);
}

.qa-question__input-area:focus-within {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 0 0 0 2px rgba(64, 158, 255, 0.2);
  border-color: var(--el-color-primary, #409eff);
}

/* 文本框样式 */
.qa-question__textarea {
  width: 100%;
  padding: 12px 16px 6px 16px;
}

.qa-question__textarea :deep(.el-textarea__inner) {
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  font-size: 14px;
  line-height: 1.55;
  color: var(--el-text-color-primary, #1f2d3d);
  resize: none;
  background: transparent;
  overflow-y: auto;
}

.qa-question__textarea :deep(.el-textarea__inner):focus {
  outline: none;
}

/* 底部操作栏 */
.qa-question__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 12px 12px;
  border-top: 1px solid var(--el-border-color-extra-light, #f0f2f5);
  flex-wrap: wrap;
  gap: 12px;
}

.qa-question__action-left {
  flex: 1;
  display: flex;
  align-items: center;
}

.input-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder, #a8abb2);
  letter-spacing: 0.2px;
  user-select: none;
}

.qa-question__action-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.clear-btn,
.send-btn {
  border-radius: 24px !important;
  padding: 6px 14px !important;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.clear-btn {
  background: transparent;
  border-color: var(--el-border-color, #dcdfe6);
  color: var(--el-text-color-regular, #606266);
}

.clear-btn:hover {
  background: var(--el-fill-color-light, #f5f7fa);
  border-color: var(--el-border-color-dark, #c0c4cc);
  transform: translateY(-1px);
}

.send-btn {
  background: var(--el-color-primary, #409eff);
  border-color: var(--el-color-primary, #409eff);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.send-btn:hover {
  background: var(--el-color-primary-light-3, #66b1ff);
  border-color: var(--el-color-primary-light-3, #66b1ff);
  transform: translateY(-1px);
}

.send-btn:active {
  transform: translateY(0);
}

/* ========== 响应式适配 (移动端) ========== */
@media (max-width: 720px) {
  

  .qa-question__toolbar {
    margin-bottom: 8px;
  }

  .new-session-btn span {
    display: inline;
  }

  .qa-question__actions {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .qa-question__action-left {
    justify-content: center;
    order: 2;
  }

  .qa-question__action-right {
    justify-content: flex-end;
    order: 1;
  }

  .clear-btn,
  .send-btn {
    flex: 0 1 auto;
    justify-content: center;
  }
}

@media (max-width: 520px) {
  .qa-question__toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .qa-question__session-info {
    font-size: 12px;
  }

  .clear-btn span,
  .send-btn span {
    display: inline;
  }

  .clear-btn,
  .send-btn {
    padding: 5px 10px !important;
  }
}

/* 暗色主题适配 (若项目支持暗色模式) */
@media (prefers-color-scheme: dark) {
  .qa-question__input-area {
    background-color: var(--el-bg-color, #1e1e2f);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  .qa-question__textarea :deep(.el-textarea__inner) {
    color: var(--el-text-color-primary, #e5e7eb);
  }

  .input-hint {
    color: var(--el-text-color-secondary, #9ca3af);
  }
}
</style>