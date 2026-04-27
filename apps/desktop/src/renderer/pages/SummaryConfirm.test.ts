// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent } from "vue";

import SummaryConfirmPage from "./SummaryConfirm.vue";
import { api } from "@/services/api";
import { useConfigStore } from "@/stores/config";

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

const GenericStub = defineComponent({
  template: "<div><slot /></div>"
});

const ElButtonStub = defineComponent({
  emits: ["click"],
  template: "<button type='button' @click=\"$emit('click', $event)\"><slot /></button>"
});

const ElCheckboxStub = defineComponent({
  props: {
    label: {
      type: String,
      required: false
    }
  },
  template: "<label><slot /></label>"
});

const testGlobals = {
  stubs: {
    EmptyState: GenericStub,
    EndpointNotice: GenericStub,
    MetricCard: GenericStub,
    StatusBadge: GenericStub,
    ElButton: ElButtonStub,
    ElSkeleton: GenericStub,
    ElCheckbox: ElCheckboxStub,
    ElCheckboxGroup: GenericStub
  }
};

describe("Summary confirm page", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const configStore = useConfigStore();
    vi.spyOn(configStore, "load").mockResolvedValue(undefined);
    configStore.data = {
      summary_output_dir: "D:/outputs/summaries",
      report_output_dir: "D:/outputs/reports"
    };
    configStore.llmStatus = {
      status: "ready",
      detail: "ok",
      checkedAt: null,
      provider: null,
      model: null,
      baseUrl: null,
      errorCategory: null
    };
    configStore.embeddingStatus = {
      status: "ready",
      detail: "ok",
      checkedAt: null,
      provider: null,
      model: null,
      baseUrl: null,
      errorCategory: null
    };
  });

  it("renders cleaning level labels from precheck items", async () => {
    vi.spyOn(api, "getSummaryPrecheck").mockResolvedValue({
      items: [
        {
          id: "pool-1",
          knowledge_item_id: "ki-1",
          title: "Enhanced PDF",
          source_type: "pdf",
          cleaning_level: "enhanced",
          current_status: "pending"
        },
        {
          id: "pool-2",
          knowledge_item_id: "ki-2",
          title: "Basic URL",
          source_type: "url",
          cleaning_level: "basic",
          current_status: "pending"
        }
      ],
      count: 2,
      output_dir: "D:/outputs/summaries",
      run_hint: "Ready to summarize 2 item(s)"
    });

    const wrapper = mount(SummaryConfirmPage, { global: testGlobals });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain("增强清洗");
    expect(wrapper.text()).toContain("基础清洗");
  });
});
