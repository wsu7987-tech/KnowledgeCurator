// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h, inject, nextTick, provide } from "vue";

import QaCenterPage from "./QaCenter.vue";
import { useConfigStore } from "@/stores/config";
import { useQaStore } from "@/stores/qa";

const GenericStub = defineComponent({
  template: "<div><slot /></div>"
});

const ElDrawerStub = defineComponent({
  props: {
    modelValue: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  emits: ["update:modelValue"],
  template: "<section v-if='modelValue'><slot /></section>"
});

const ElSegmentedStub = defineComponent({
  props: {
    modelValue: {
      type: String,
      required: false,
      default: ""
    },
    options: {
      type: Array,
      required: false,
      default: () => []
    }
  },
  emits: ["update:modelValue"],
  template: `
    <div>
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        @click="$emit('update:modelValue', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  `
});

const collapseKey = Symbol("collapse");

const ElCollapseStub = defineComponent({
  props: {
    modelValue: {
      type: Array,
      required: false,
      default: () => []
    }
  },
  emits: ["update:modelValue"],
  setup(props, { emit, slots }) {
    const context = {
      isActive: (name: string) => (props.modelValue as string[]).includes(name),
      toggle: (name: string) => {
        const current = props.modelValue as string[];
        emit(
          "update:modelValue",
          current.includes(name)
            ? current.filter((entry) => entry !== name)
            : [...current, name]
        );
      }
    };
    provide(collapseKey, context);
    return () => h("div", slots.default?.());
  }
});

const ElCollapseItemStub = defineComponent({
  inheritAttrs: false,
  props: {
    name: {
      type: String,
      required: true
    }
  },
  setup(props, { attrs, slots }) {
    const context = inject<{
      isActive: (name: string) => boolean;
      toggle: (name: string) => void;
    }>(collapseKey);
    return () =>
      h("section", attrs, [
        h("button", { type: "button", onClick: () => context?.toggle(props.name) }, slots.title?.()),
        context?.isActive(props.name) ? h("div", slots.default?.()) : null
      ]);
  }
});

const ElButtonStub = defineComponent({
  emits: ["click"],
  template: "<button type='button' @click=\"$emit('click', $event)\"><slot /></button>"
});

const ElInputStub = defineComponent({
  props: {
    modelValue: {
      type: String,
      required: false,
      default: ""
    },
    type: {
      type: String,
      required: false,
      default: "text"
    }
  },
  emits: ["update:modelValue"],
  methods: {
    emitInput(event: Event) {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      this.$emit("update:modelValue", target?.value ?? "");
    }
  },
  template: `
    <textarea
      v-if="type === 'textarea'"
      :value="modelValue"
      @input="emitInput"
    />
    <input
      v-else
      :value="modelValue"
      @input="emitInput"
    />
  `
});

const testGlobals = {
  stubs: {
    EmptyState: GenericStub,
    EndpointNotice: GenericStub,
    ElButton: ElButtonStub,
    ElInput: ElInputStub,
    ElForm: GenericStub,
    ElFormItem: GenericStub,
    ElSelect: GenericStub,
    ElSegmented: ElSegmentedStub,
    ElCollapse: ElCollapseStub,
    ElCollapseItem: ElCollapseItemStub,
    ElOption: GenericStub,
    ElCheckbox: GenericStub,
    ElCheckboxGroup: GenericStub,
    ElDrawer: ElDrawerStub,
    ElTag: GenericStub
  }
};

describe("QA center page", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();

    const configStore = useConfigStore();
    vi.spyOn(configStore, "load").mockResolvedValue(undefined);
    configStore.data = {};
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

    const qaStore = useQaStore();
    vi.spyOn(qaStore, "loadSessions").mockResolvedValue([]);
  });

  it("renders answer, citations and grounded items from the qa store", async () => {
    const qaStore = useQaStore();
    qaStore.result = {
      session_id: "session-1",
      mode: "answer",
      rewritten_question: "What is alpha?",
      rewrite: {
        rewritten_question: "What is alpha?",
        requires_history: false,
        used_history: false,
        intent: "answer",
        risk_flags: ["self_contained"],
        confidence: 0.72,
        strategy: "heuristic"
      },
      question: "What is alpha?",
      answer: "Alpha answer",
      answer_status: "grounded",
      confidence: 0.83,
      applied_filters: {
        source_types: ["text"],
        knowledge_item_ids: ["ki-1"],
        keyword: "alpha",
        category: "research",
        user_tags: ["alpha"],
        ai_tags: ["report"]
      },
      citations: [
        {
          citation_id: "cite-1",
          rank: 1,
          knowledge_item_id: "ki-1",
          chunk_id: "chunk-1",
          parent_chunk_id: "parent-1",
          title: "Alpha report",
          section_title: "Section A",
          source_type: "text",
          source_name: "alpha.txt",
          source_value: "alpha.txt",
          created_at: "2026-04-23T00:00:00Z",
          snippet: "Alpha snippet",
          context_snippet: "Alpha context",
          expanded_context_snippet: "Alpha expanded context"
        }
      ],
      used_grounded_items: [
        {
          snapshot_id: "snapshot-1",
          title: "Alpha report",
          final_category: "research",
          claim: "Alpha grounded claim",
          citation_ids: ["summary-cite-1"],
          evidence_titles: ["Alpha report"]
        }
      ],
      suggested_queries: [],
      verification: {
        status: "passed",
        reason: "citation_terms_support_answer",
        supported_terms: 3,
        answer_terms: 4
      },
      retry_count: 1
    };

    const wrapper = mount(QaCenterPage, { global: testGlobals });
    await nextTick();

    expect(wrapper.text()).toContain("问答中心");
    expect(wrapper.text()).toContain("Alpha answer");
    expect(wrapper.find("[data-testid='qa-chat-thread']").text()).toContain("原文证据 1 条");
    expect(wrapper.find("[data-testid='qa-chat-thread']").text()).toContain("辅助摘要 1 条");

    await wrapper.find("[data-testid='qa-citations-link']").trigger("click");
    await nextTick();
    expect(wrapper.find("[data-testid='qa-evidence-drawer']").text()).toContain("Alpha report");
    expect(wrapper.find("[data-testid='qa-evidence-drawer']").text()).toContain("Alpha snippet");

    await wrapper.find("[data-testid='qa-grounded-link']").trigger("click");
    await nextTick();
    expect(wrapper.find("[data-testid='qa-evidence-drawer']").text()).toContain("Alpha grounded claim");
    expect(wrapper.find("[data-testid='qa-trace-card-body']").text()).toContain("heuristic");
    expect(wrapper.find("[data-testid='qa-trace-card-body']").text()).toContain("passed");
    expect(wrapper.find("[data-testid='qa-trace-card-body']").text()).toContain("1");
    expect(wrapper.find("[data-testid='qa-trace-card-body']").text()).toContain("cite-1");
  });

  it("renders sessions at the bottom of the side column and can collapse them", async () => {
    const qaStore = useQaStore();
    qaStore.sessions = [
      {
        session_id: "session-1",
        title: "Alpha session",
        mode: "answer",
        created_at: "2026-04-24T00:00:00Z",
        updated_at: "2026-04-24T00:01:00Z",
        message_count: 2
      }
    ];

    const wrapper = mount(QaCenterPage, { global: testGlobals });
    await nextTick();

    const sideCards = wrapper.findAll("[data-testid='qa-side-card']");
    expect(sideCards.at(-1)?.attributes("data-card")).toBe("sessions");
    expect(wrapper.find("[data-testid='qa-session-card-body']").exists()).toBe(true);

    await wrapper.find("[data-testid='qa-session-card-toggle']").trigger("click");

    expect(wrapper.find("[data-testid='qa-session-card-body']").exists()).toBe(false);
  });

  it("opens a persisted session and renders it as chat messages", async () => {
    const qaStore = useQaStore();
    qaStore.sessions = [
      {
        session_id: "session-1",
        title: "Alpha session",
        mode: "answer",
        created_at: "2026-04-24T00:00:00Z",
        updated_at: "2026-04-24T00:01:00Z",
        message_count: 2
      }
    ];
    vi.spyOn(qaStore, "loadSession").mockImplementation(async (sessionId: string) => {
      qaStore.selectedSessionId = sessionId;
      qaStore.sessionDetail = {
        session_id: sessionId,
        title: "Alpha session",
        mode: "answer",
        created_at: "2026-04-24T00:00:00Z",
        updated_at: "2026-04-24T00:01:00Z",
        message_count: 2,
        messages: [
          {
            message_id: "msg-1",
            role: "user",
            content: "What is alpha?",
            created_at: "2026-04-24T00:00:00Z"
          },
          {
            message_id: "msg-2",
            role: "assistant",
            content: "Alpha answer",
            created_at: "2026-04-24T00:00:30Z",
            question: "What is alpha?",
            rewritten_question: "What is alpha?",
            rewrite: {
              rewritten_question: "What is alpha?",
              requires_history: false,
              used_history: false,
              intent: "answer",
              risk_flags: ["self_contained"],
              confidence: 0.72,
              strategy: "heuristic"
            },
            answer_status: "grounded",
            confidence: 0.8,
            citations: [],
            used_grounded_items: [],
            suggested_queries: [],
            applied_filters: {}
          }
        ]
      };
      return qaStore.sessionDetail;
    });

    const wrapper = mount(QaCenterPage, { global: testGlobals });
    await nextTick();
    await wrapper.find("[data-testid='qa-session-item']").trigger("click");
    await nextTick();

    expect(qaStore.loadSession).toHaveBeenCalledWith("session-1");
    expect(wrapper.find("[data-testid='qa-chat-thread']").text()).toContain("What is alpha?");
    expect(wrapper.find("[data-testid='qa-chat-thread']").text()).toContain("Alpha answer");
  });
});
