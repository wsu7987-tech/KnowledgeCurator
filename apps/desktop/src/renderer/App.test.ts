// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, reactive } from "vue";

import App from "./App.vue";
import { useNoticesStore } from "@/stores/notices";

const routeState = reactive<{
  name: string;
  query: Record<string, string>;
}>({
  name: "pool",
  query: {}
});

vi.mock("vue-router", () => ({
  useRoute: () => routeState,
  RouterView: defineComponent({
    template: "<div data-testid='router-view'>router-view</div>"
  })
}));

const AppShellStub = defineComponent({
  template: "<div data-testid='app-shell'><slot /></div>"
});

const SettingsDrawerStub = defineComponent({
  props: {
    open: {
      type: Boolean,
      default: false
    }
  },
  template: "<div data-testid='settings-drawer'>settings</div>"
});

const ElAlertStub = defineComponent({
  props: {
    title: {
      type: String,
      default: ""
    }
  },
  template: "<div data-testid='notice-alert'>{{ title }}</div>"
});

describe("App", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    routeState.name = "pool";
    routeState.query = {};
  });

  it("renders the shell for normal pool mode", () => {
    const noticesStore = useNoticesStore();
    noticesStore.items = [
      {
        id: "notice-1",
        kind: "info",
        title: "Notice",
        message: "message"
      }
    ];

    const wrapper = mount(App, {
      global: {
        stubs: {
          AppShell: AppShellStub,
          SettingsDrawer: SettingsDrawerStub,
          ElAlert: ElAlertStub
        }
      }
    });

    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-drawer"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="notice-alert"]').exists()).toBe(true);
  });

  it("hides the shell for pool quick capture mode", () => {
    const noticesStore = useNoticesStore();
    noticesStore.items = [
      {
        id: "notice-1",
        kind: "info",
        title: "Notice",
        message: "message"
      }
    ];
    routeState.query = {
      mode: "quick-capture"
    };

    const wrapper = mount(App, {
      global: {
        stubs: {
          AppShell: AppShellStub,
          SettingsDrawer: SettingsDrawerStub,
          ElAlert: ElAlertStub
        }
      }
    });

    expect(wrapper.find('[data-testid="router-view"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="settings-drawer"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="notice-alert"]').exists()).toBe(false);
  });
});
