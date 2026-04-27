// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, nextTick, reactive } from "vue";

import PoolPage from "./Pool.vue";
import { api } from "@/services/api";
import { useConfigStore } from "@/stores/config";
import { usePoolStore } from "@/stores/pool";
import { useWebDraftStore } from "@/stores/webDraft";

const routeState = reactive<{
  name: string;
  query: Record<string, string>;
}>({
  name: "pool",
  query: {}
});

const routerPushMock = vi.fn(
  async (location?: { name?: string; query?: Record<string, string> }) => {
    routeState.name = location?.name ?? routeState.name;
    routeState.query = location?.query ?? {};
  }
);
const routerReplaceMock = vi.fn(
  async (location?: { name?: string; query?: Record<string, string> }) => {
    routeState.name = location?.name ?? routeState.name;
    routeState.query = location?.query ?? {};
  }
);

vi.mock("vue-router", () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock
  })
}));

const GenericStub = defineComponent({
  template: "<div><slot /></div>"
});

const ElButtonStub = defineComponent({
  inheritAttrs: false,
  emits: ["click"],
  template:
    "<button v-bind=\"$attrs\" type='button' @click=\"$emit('click', $event)\"><slot /></button>"
});

const ElDrawerStub = defineComponent({
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  template: "<div v-if='modelValue'><slot /><slot name='footer' /></div>"
});

const PoolItemsTableStub = defineComponent({
  template:
    "<section><button type='button'>刷新列表</button><span>状态说明</span></section>"
});

const testGlobals = {
  stubs: {
    EmptyState: GenericStub,
    EndpointNotice: GenericStub,
    MetricCard: GenericStub,
    PoolEntryMarkdownForm: GenericStub,
    PoolEntryPdfForm: GenericStub,
    PoolEntryTextForm: GenericStub,
    PoolEntryUrlForm: GenericStub,
    PoolItemsTable: PoolItemsTableStub,
    PoolMetadataFields: GenericStub,
    StatusBadge: GenericStub,
    ElButton: ElButtonStub,
    ElForm: GenericStub,
    ElFormItem: GenericStub,
    ElSegmented: GenericStub,
    ElInput: GenericStub,
    ElSelect: GenericStub,
    ElOption: GenericStub,
    ElTag: GenericStub,
    ElDrawer: ElDrawerStub,
    ElDialog: GenericStub,
    ElPopover: GenericStub,
    ElTooltip: GenericStub,
    ElProgress: GenericStub,
    ElSkeleton: GenericStub,
    Delete: true,
    InfoFilled: true,
    Link: true,
    Plus: true,
    RefreshRight: true
  },
  directives: {
    loading: {}
  }
};

const webDraftResponse = {
  draft: {
    id: "web-draft-1",
    url: "https://example.com/a",
    title: "Example",
    source_name: "example.com",
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    saved_parse_result_id: "parse-1",
    latest_preview_result_id: "parse-1",
    parse_results: [
      {
        id: "parse-1",
        parser_name: "playwright_dom",
        status: "saved",
        raw_text: "alpha",
        markdown_text: "# Alpha",
        preview_text: "# Alpha",
        section_count: 1,
        char_count: 5,
        quality_score: 0.9,
        warnings: [],
        auth_mode: "browser_profile",
        created_at: "2026-04-20T00:00:00Z"
      }
    ]
  },
  job: {
    id: "web-job-1",
    draft_id: "web-draft-1",
    parser_name: "playwright_dom",
    status: "completed",
    created_at: "2026-04-20T00:00:00Z",
    processed_pages: 1,
    total_pages: 1,
    latest_available_page: 1,
    cancel_requested: false,
    preview_result_id: "parse-1"
  }
};

describe("Pool page", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    routeState.name = "pool";
    routeState.query = {};
    routerPushMock.mockClear();
    routerReplaceMock.mockClear();
    const configStore = useConfigStore();
    const poolStore = usePoolStore();
    vi.spyOn(configStore, "load").mockResolvedValue(undefined);
    vi.spyOn(poolStore, "fetchItems").mockResolvedValue(undefined);
  });

  it("shows parse-and-preview as the primary action for the url tab", () => {
    const wrapper = mount(PoolPage, { global: testGlobals });

    expect(wrapper.text()).toContain("解析并预览");
  });

  it("renders web draft preview controls including cleaning status text", async () => {
    const webDraftStore = useWebDraftStore();
    vi.spyOn(api, "createWebDraft").mockResolvedValue(webDraftResponse as never);

    await webDraftStore.createDraft({
      url: "https://example.com/a",
      title: "Example",
      session_profile_id: null
    });

    const wrapper = mount(PoolPage, { global: testGlobals });

    expect(wrapper.text()).toContain("网页任务列表");
    expect(wrapper.text()).toContain("Example");
    expect(wrapper.text()).toContain("已就绪");
    expect(wrapper.text()).toContain("增强清洗");
    expect(wrapper.text()).toContain("还原");
  });

  it("switches into quick capture mode and hides pool-only sections", async () => {
    const wrapper = mount(PoolPage, { global: testGlobals });

    expect(wrapper.text()).toContain("快速集采模式");
    expect(wrapper.text()).toContain("刷新列表");
    expect(wrapper.text()).toContain("状态说明");

    await wrapper.get('[data-testid="quick-capture-toggle"]').trigger("click");
    await nextTick();

    expect(wrapper.text()).toContain("退出");
    expect(wrapper.text()).not.toContain("刷新列表");
    expect(wrapper.text()).not.toContain("状态说明");
  });

  it("hides preview task actions while quick capture mode is active", async () => {
    const webDraftStore = useWebDraftStore();
    const openTaskSpy = vi.spyOn(webDraftStore, "openTask");
    vi.spyOn(api, "createWebDraft").mockResolvedValue(webDraftResponse as never);

    await webDraftStore.createDraft({
      url: "https://example.com/a",
      title: "Example",
      session_profile_id: null
    });

    const wrapper = mount(PoolPage, { global: testGlobals });
    await wrapper.get('[data-testid="quick-capture-toggle"]').trigger("click");
    await nextTick();
    expect(wrapper.text()).not.toContain("查看详情");

    expect(openTaskSpy).not.toHaveBeenCalled();
  });
});
