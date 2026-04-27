// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent } from "vue";

import ItemDetailPage from "./ItemDetail.vue";
import { api } from "@/services/api";
import { openPath, saveTextFile } from "@/services/desktop-bridge";

const pushMock = vi.fn();

vi.mock("vue-router", () => ({
  useRoute: () => ({
    params: { snapshotId: "snapshot-1" },
    query: {}
  }),
  useRouter: () => ({
    push: pushMock
  })
}));

vi.mock("@/services/desktop-bridge", () => ({
  openPath: vi.fn().mockResolvedValue(null),
  saveTextFile: vi.fn().mockResolvedValue("D:/tmp/original-alpha.md")
}));

const GenericStub = defineComponent({
  template: "<div><slot /></div>"
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
    }
  },
  emits: ["update:modelValue"],
  methods: {
    emitInput(event: Event) {
      const target = event.target as HTMLInputElement | null;
      this.$emit("update:modelValue", target?.value ?? "");
    }
  },
  template: "<input :value='modelValue' @input='emitInput' />"
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
  template: "<div v-if='modelValue' class='drawer-stub'><slot /></div>"
});

const testGlobals = {
  stubs: {
    EmptyState: GenericStub,
    EndpointNotice: GenericStub,
    ElButton: ElButtonStub,
    ElInput: ElInputStub,
    ElDrawer: ElDrawerStub,
    ElForm: GenericStub,
    ElFormItem: GenericStub,
    ElTag: GenericStub
  }
};

describe("item detail page", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    pushMock.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn()
    });
  });

  it("opens the original reader as a dialog, scrolls to matched content, and exports original markdown", async () => {
    vi.mocked(openPath).mockResolvedValue("");
    vi.mocked(saveTextFile).mockResolvedValue("D:/tmp/original-alpha.md");

    vi.spyOn(api, "getResult").mockResolvedValue({
      id: "snapshot-1",
      knowledge_item_id: "ki-1",
      summary_run_id: "run-1",
      title: "Alpha article",
      source_type: "url",
      source_value: "https://example.com/alpha",
      generated_category: "general",
      generated_tags: ["alpha"],
      final_category: "general",
      final_tags: ["alpha"],
      summary_text: "Alpha summary",
      viewpoint_text: "Alpha viewpoint",
      controversy_text: null,
      markdown_path: "D:/tmp/alpha.md",
      markdown_filename: "alpha.md",
      markdown_content: "# Alpha summary",
      created_at: "2026-04-24T00:00:00Z",
      edited_at: "2026-04-24T00:00:00Z",
      relation_meta: {},
      evidence_bundle: {
        citations: [
          {
            citation_id: "cite-1",
            rank: 1,
            knowledge_item_id: "ki-1",
            chunk_id: "chunk-1",
            parent_chunk_id: "parent-1",
            title: "Alpha article",
            section_title: "Section A",
            source_type: "url",
            source_name: "Alpha article",
            source_value: "https://example.com/alpha",
            created_at: "2026-04-24T00:00:00Z",
            snippet: "Alpha is the main concept in this section.",
            context_snippet: "Alpha context",
            expanded_context_snippet: "Alpha expanded context"
          }
        ],
        grounded_claims: [],
        summary_segments: []
      },
      summary_meta: {
        one_sentence_takeaway: "Alpha takeaway",
        reading_focus: ["先看 alpha 定义"],
        key_points: ["Alpha is the main concept in this section."],
        article_keywords: [{ keyword: "alpha", weight: 0.9 }],
        reader_guide: {
          what_it_is: "这篇文档解释 alpha 是什么。",
          why_it_matters: "它决定后续理解路径。",
          how_to_apply: ["先看定义", "再看例子"],
          core_concepts: ["alpha"],
          study_path: ["先看摘要", "再看原文"]
        }
      }
    });
    vi.spyOn(api, "getActiveParseResult").mockResolvedValue({
      parse_result: {
        knowledge_item_id: "ki-1",
        source_type: "url",
        source_value: "https://example.com/alpha",
        title: "Alpha article",
        canonical_content:
          "# Alpha article\n\nAlpha is the main concept in this section.\n\nBeta is secondary.",
        id: "parse-1",
        parser_name: "playwright_dom",
        status: "saved",
        raw_text: "Alpha is the main concept in this section. Beta is secondary.",
        markdown_text:
          "# Alpha article\n\nAlpha is the main concept in this section.\n\nBeta is secondary.",
        preview_text: "Alpha is the main concept in this section.",
        page_count: 1,
        char_count: 80,
        quality_score: 0.9,
        is_ocr: false,
        warnings: [],
        fallback_from: null,
        fallback_reason: null,
        created_at: "2026-04-24T00:00:00Z",
        saved_at: "2026-04-24T00:00:00Z"
      }
    });

    const wrapper = mount(ItemDetailPage, { global: testGlobals });
    await flushPromises();

    expect(wrapper.text()).toContain("学习导读");
    expect(wrapper.text()).toContain("原文证据定位");
    expect(wrapper.text()).toContain("打开原文阅读器");
    expect(wrapper.find(".drawer-stub").exists()).toBe(false);

    const citationFocusButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("定位到原文"));
    expect(citationFocusButton).toBeDefined();

    await citationFocusButton!.trigger("click");
    await flushPromises();

    expect(wrapper.find(".drawer-stub").exists()).toBe(true);
    expect(wrapper.text()).toContain("原文阅读器");
    expect(wrapper.text()).toContain("命中位置");
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    const keyPointButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("定位知识点"));
    expect(keyPointButton).toBeDefined();

    await keyPointButton!.trigger("click");
    await flushPromises();

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    expect(wrapper.find(".is-reader-focused").exists()).toBe(true);

    const openOriginalMarkdownButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("打开原文 MD"));
    expect(openOriginalMarkdownButton).toBeDefined();

    await openOriginalMarkdownButton!.trigger("click");
    await flushPromises();

    expect(saveTextFile).toHaveBeenCalled();
    expect(openPath).toHaveBeenCalledWith("D:/tmp/original-alpha.md");
  });
});
