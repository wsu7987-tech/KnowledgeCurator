// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { computed, defineComponent, ref, type PropType } from "vue";

import PoolEntryMarkdownForm from "./PoolEntryMarkdownForm.vue";
import PoolEntryPdfForm from "./PoolEntryPdfForm.vue";
import PoolEntryTextForm from "./PoolEntryTextForm.vue";
import PoolEntryUrlForm from "./PoolEntryUrlForm.vue";
import WebSessionManagerDialog from "./WebSessionManagerDialog.vue";
import type { PoolEntryFormExpose } from "./pool-entry-form";
import { usePdfDraftStore } from "@/stores/pdfDraft";
import { usePoolStore } from "@/stores/pool";
import { useWebDraftStore } from "@/stores/webDraft";
import { useWebSessionProfilesStore } from "@/stores/webSessionProfiles";

const GenericStub = defineComponent({
  template: "<div><slot /></div>"
});

const ElFormStub = defineComponent({
  name: "ElForm",
  template: "<form><slot /></form>"
});

const ElFormItemStub = defineComponent({
  name: "ElFormItem",
  props: {
    label: {
      type: String,
      default: ""
    }
  },
  template: "<label><span>{{ label }}</span><slot /></label>"
});

const ElButtonStub = defineComponent({
  name: "ElButton",
  emits: ["click"],
  template: "<button type='button' @click=\"$emit('click', $event)\"><slot /></button>"
});

const ElInputStub = defineComponent({
  name: "ElInput",
  inheritAttrs: false,
  props: {
    modelValue: {
      type: String,
      default: ""
    },
    type: {
      type: String,
      default: "text"
    },
    placeholder: {
      type: String,
      default: ""
    },
    rows: {
      type: Number,
      default: 2
    }
  },
  emits: ["update:modelValue"],
  template: `
    <div>
      <textarea
        v-if="type === 'textarea'"
        v-bind="$attrs"
        :value="modelValue"
        :placeholder="placeholder"
        :rows="rows"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <input
        v-else
        v-bind="$attrs"
        :value="modelValue"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <slot name="append" />
    </div>
  `
});

const ElSelectStub = defineComponent({
  name: "ElSelect",
  props: {
    modelValue: {
      type: [String, Number, Array] as PropType<string | number | string[] | null>,
      default: null
    },
    multiple: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: ""
    }
  },
  emits: ["update:modelValue"],
  computed: {
    normalizedValue(): string {
      return Array.isArray(this.modelValue)
        ? this.modelValue.join(", ")
        : String(this.modelValue ?? "");
    }
  },
  methods: {
    onInput(event: Event) {
      const value = (event.target as HTMLInputElement).value;
      if (this.multiple) {
        this.$emit(
          "update:modelValue",
          value
            .split(/[\n,\uff0c]/)
            .map((item) => item.trim())
            .filter(Boolean)
        );
        return;
      }
      this.$emit("update:modelValue", value || null);
    }
  },
  template: `
    <input
      v-bind="$attrs"
      :value="normalizedValue"
      :placeholder="placeholder"
      @input="onInput"
    />
  `
});

const ElOptionStub = defineComponent({
  name: "ElOption",
  props: {
    label: {
      type: String,
      default: ""
    },
    value: {
      type: [String, Number, null],
      default: null
    }
  },
  template: "<option :value='value ?? \"\"'>{{ label }}</option>"
});

const EndpointNoticeStub = defineComponent({
  name: "EndpointNotice",
  template: "<div data-testid='endpoint-notice'><slot /></div>"
});

const ElDialogStub = defineComponent({
  name: "ElDialog",
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  template: "<div v-if='modelValue'><slot /><slot name='footer' /></div>"
});

const testGlobals = {
  stubs: {
    ElForm: ElFormStub,
    ElFormItem: ElFormItemStub,
    ElButton: ElButtonStub,
    ElInput: ElInputStub,
    ElSelect: ElSelectStub,
    ElOption: ElOptionStub,
    ElDialog: ElDialogStub,
    ElTag: GenericStub,
    EndpointNotice: EndpointNoticeStub,
    ElAlert: true,
    FolderOpened: true
  }
};

const Host = defineComponent({
  name: "PoolEntryFormsHost",
  components: {
    PoolEntryUrlForm,
    PoolEntryPdfForm,
    PoolEntryMarkdownForm,
    PoolEntryTextForm
  },
  setup() {
    const activeSourceType = ref<"url" | "pdf" | "markdown" | "text">("url");
    const urlFormRef = ref<PoolEntryFormExpose | null>(null);
    const pdfFormRef = ref<PoolEntryFormExpose | null>(null);
    const markdownFormRef = ref<PoolEntryFormExpose | null>(null);
    const textFormRef = ref<PoolEntryFormExpose | null>(null);

    const activeForm = computed(() => {
      switch (activeSourceType.value) {
        case "pdf":
          return pdfFormRef.value;
        case "markdown":
          return markdownFormRef.value;
        case "text":
          return textFormRef.value;
        case "url":
        default:
          return urlFormRef.value;
      }
    });

    const submitActive = async () => {
      await activeForm.value?.submit();
    };

    return {
      activeSourceType,
      urlFormRef,
      pdfFormRef,
      markdownFormRef,
      textFormRef,
      submitActive
    };
  },
  template: `
    <div>
      <button data-testid="tab-url" type="button" @click="activeSourceType = 'url'">URL</button>
      <button data-testid="tab-pdf" type="button" @click="activeSourceType = 'pdf'">PDF</button>
      <button data-testid="tab-markdown" type="button" @click="activeSourceType = 'markdown'">Markdown</button>
      <button data-testid="tab-text" type="button" @click="activeSourceType = 'text'">Text</button>
      <button data-testid="submit-active" type="button" @click="submitActive">submit</button>

      <PoolEntryUrlForm v-show="activeSourceType === 'url'" ref="urlFormRef" />
      <PoolEntryPdfForm v-show="activeSourceType === 'pdf'" ref="pdfFormRef" />
      <PoolEntryMarkdownForm v-show="activeSourceType === 'markdown'" ref="markdownFormRef" />
      <PoolEntryTextForm v-show="activeSourceType === 'text'" ref="textFormRef" />
    </div>
  `
});

describe("pool entry forms host", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const webSessionProfilesStore = useWebSessionProfilesStore();
    webSessionProfilesStore.profiles = [];
    vi.spyOn(webSessionProfilesStore, "loadProfiles").mockResolvedValue([]);
  });

  it("keeps each tab's local input isolated across tab switches", async () => {
    const wrapper = mount(Host, { global: testGlobals });

    await wrapper.get('[data-testid="url-source"]').setValue("https://example.com/a");
    await wrapper.get('[data-testid="url-title"]').setValue("URL Title");

    await wrapper.get('[data-testid="tab-text"]').trigger("click");
    await wrapper.get('[data-testid="text-source"]').setValue("text-source");
    await wrapper.get('[data-testid="text-raw"]').setValue("text body");

    await wrapper.get('[data-testid="tab-url"]').trigger("click");
    expect(
      (wrapper.get('[data-testid="url-source"]').element as HTMLInputElement).value
    ).toBe("https://example.com/a");
    expect(
      (wrapper.get('[data-testid="url-title"]').element as HTMLInputElement).value
    ).toBe("URL Title");

    await wrapper.get('[data-testid="tab-text"]').trigger("click");
    expect(
      (wrapper.get('[data-testid="text-source"]').element as HTMLInputElement).value
    ).toBe("text-source");
    expect(
      (wrapper.get('[data-testid="text-raw"]').element as HTMLTextAreaElement).value
    ).toBe("text body");
  });

  it("clears only the active non-pdf tab after a successful submit", async () => {
    const webDraftStore = useWebDraftStore();
    vi.spyOn(webDraftStore, "createDraft").mockResolvedValue({
      id: "web-draft-1",
      url: "https://example.com/a",
      title: "URL Title",
      source_name: "example.com",
      session_profile_id: null,
      created_at: "2026-04-19T00:00:00Z",
      updated_at: "2026-04-19T00:00:00Z",
      saved_parse_result_id: null,
      latest_preview_result_id: "parse-1",
      parse_results: []
    });

    const wrapper = mount(Host, { global: testGlobals });

    await wrapper.get('[data-testid="url-source"]').setValue("https://example.com/a");
    await wrapper.get('[data-testid="url-title"]').setValue("URL Title");

    await wrapper.get('[data-testid="tab-text"]').trigger("click");
    await wrapper.get('[data-testid="text-source"]').setValue("text-source");
    await wrapper.get('[data-testid="text-raw"]').setValue("text body");

    await wrapper.get('[data-testid="tab-url"]').trigger("click");
    await wrapper.get('[data-testid="submit-active"]').trigger("click");

    expect(webDraftStore.createDraft).toHaveBeenCalledWith({
      url: "https://example.com/a",
      title: "URL Title",
      session_profile_id: null
    });
    expect(
      (wrapper.get('[data-testid="url-source"]').element as HTMLInputElement).value
    ).toBe("");
    expect(
      (wrapper.get('[data-testid="url-title"]').element as HTMLInputElement).value
    ).toBe("");

    await wrapper.get('[data-testid="tab-text"]').trigger("click");
    expect(
      (wrapper.get('[data-testid="text-source"]').element as HTMLInputElement).value
    ).toBe("text-source");
    expect(
      (wrapper.get('[data-testid="text-raw"]').element as HTMLTextAreaElement).value
    ).toBe("text body");
  });

  it("passes the PDF title into createDraft and clears PDF inputs after success", async () => {
    const pdfDraftStore = usePdfDraftStore();
    vi.spyOn(pdfDraftStore, "createDraft").mockResolvedValue({
      id: "draft-1",
      file_path: "D:/docs/demo.pdf",
      title: "PDF Title",
      source_name: "demo.pdf",
      created_at: "2026-04-19T00:00:00Z",
      updated_at: "2026-04-19T00:00:00Z",
      saved_parse_result_id: null,
      latest_preview_result_id: "parse-1",
      parse_results: []
    });

    const wrapper = mount(Host, { global: testGlobals });

    await wrapper.get('[data-testid="tab-pdf"]').trigger("click");
    await wrapper.get('[data-testid="pdf-source"]').setValue("D:/docs/demo.pdf");
    await wrapper.get('[data-testid="pdf-title"]').setValue("PDF Title");
    await wrapper.get('[data-testid="submit-active"]').trigger("click");

    expect(pdfDraftStore.createDraft).toHaveBeenCalledWith({
      file_path: "D:/docs/demo.pdf",
      title: "PDF Title"
    });
    expect(
      (wrapper.get('[data-testid="pdf-source"]').element as HTMLInputElement).value
    ).toBe("");
    expect(
      (wrapper.get('[data-testid="pdf-title"]').element as HTMLInputElement).value
    ).toBe("");
  });

  it("submits the selected web session profile with the URL draft request", async () => {
    const webDraftStore = useWebDraftStore();
    const webSessionProfilesStore = useWebSessionProfilesStore();
    webSessionProfilesStore.profiles = [
      {
        id: "session-1",
        name: "知乎登录",
        mode: "app_session",
        browser_channel: "chromium",
        profile_path: null,
        managed_profile_path: "D:/session-1",
        login_url: "https://example.com/login",
        status: "ready",
        status_detail: "可用",
        created_at: "2026-04-20T00:00:00Z",
        updated_at: "2026-04-20T00:00:00Z"
      }
    ];
    vi.spyOn(webDraftStore, "createDraft").mockResolvedValue({
      id: "web-draft-1",
      url: "https://example.com/a",
      title: "URL Title",
      source_name: "example.com",
      session_profile_id: "session-1",
      created_at: "2026-04-19T00:00:00Z",
      updated_at: "2026-04-19T00:00:00Z",
      saved_parse_result_id: null,
      latest_preview_result_id: "parse-1",
      parse_results: []
    });

    const wrapper = mount(Host, { global: testGlobals });

    await wrapper.get('[data-testid="url-source"]').setValue("https://example.com/a");
    await wrapper.get('[data-testid="url-title"]').setValue("URL Title");
    await wrapper.get('[data-testid="url-session-select"]').setValue("session-1");
    await wrapper.get('[data-testid="submit-active"]').trigger("click");

    expect(webDraftStore.createDraft).toHaveBeenCalledWith({
      url: "https://example.com/a",
      title: "URL Title",
      session_profile_id: "session-1"
    });
  });

  it("shows browser profile lookup tips in the session manager", () => {
    const wrapper = mount(WebSessionManagerDialog, {
      props: {
        modelValue: true
      },
      global: testGlobals
    });

    expect(wrapper.text()).toContain("chrome://version");
    expect(wrapper.text()).toContain("Profile Path");
    expect(wrapper.text()).toContain("User Data");
  });

  it("submits metadata fields with the text entry form", async () => {
    const poolStore = usePoolStore();
    vi.spyOn(poolStore, "addItem").mockResolvedValue({
      id: "pool-1",
      source_type: "text"
    } as never);

    const wrapper = mount(Host, { global: testGlobals });

    await wrapper.get('[data-testid="tab-text"]').trigger("click");
    await wrapper.get('[data-testid="text-source"]').setValue("text-source");
    await wrapper.get('[data-testid="text-title"]').setValue("Backend note");
    await wrapper.get('[data-testid="text-category"]').setValue("engineering");
    await wrapper.get('[data-testid="text-tags"]').setValue("backend, database");
    await wrapper.get('[data-testid="text-raw"]').setValue("Database indexing and API workflow");
    await wrapper.get('[data-testid="submit-active"]').trigger("click");

    expect(poolStore.addItem).toHaveBeenCalledWith({
      source_type: "text",
      source_value: "text-source",
      title: "Backend note",
      category: "engineering",
      tags: ["backend", "database"],
      raw_text: "Database indexing and API workflow"
    });
  });

  it("submits metadata fields with the markdown entry form", async () => {
    const poolStore = usePoolStore();
    vi.spyOn(poolStore, "addItem").mockResolvedValue({
      id: "pool-2",
      source_type: "markdown"
    } as never);

    const wrapper = mount(Host, { global: testGlobals });

    await wrapper.get('[data-testid="tab-markdown"]').trigger("click");
    await wrapper.get('[data-testid="markdown-source"]').setValue("D:/docs/demo.md");
    await wrapper.get('[data-testid="markdown-title"]').setValue("Architecture note");
    await wrapper.get('[data-testid="markdown-category"]').setValue("engineering");
    await wrapper.get('[data-testid="markdown-tags"]').setValue("rag, architecture");
    await wrapper.get('[data-testid="markdown-raw"]').setValue("## Title\nSystem design details");
    await wrapper.get('[data-testid="submit-active"]').trigger("click");

    expect(poolStore.addItem).toHaveBeenCalledWith({
      source_type: "markdown",
      source_value: "D:/docs/demo.md",
      title: "Architecture note",
      category: "engineering",
      tags: ["rag", "architecture"],
      raw_text: "## Title\nSystem design details"
    });
  });
});
