import { createRouter, createWebHashHistory } from "vue-router";

import HistoryPage from "@/pages/History.vue";
import ItemDetailPage from "@/pages/ItemDetail.vue";
import PoolPage from "@/pages/pool/index.vue";
import QaCenterPage from "@/pages/QaCenter/index.vue";
import QuickCapturePage from "@/pages/QuickCapture.vue";
import ReportCenterPage from "@/pages/ReportCenter.vue";
import RunCenterPage from "@/pages/RunCenter.vue";
import RunDetailPage from "@/pages/RunDetail.vue";
import SummaryConfirmPage from "@/pages/SummaryConfirm.vue";
import SummaryProgressPage from "@/pages/SummaryProgress.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      redirect: "/pool"
    },
    {
      path: "/pool",
      name: "pool",
      component: PoolPage,
      meta: { title: "总结池" }
    },
    {
      path: "/quick-capture",
      name: "quick-capture",
      component: QuickCapturePage,
      meta: { title: "快速采集" }
    },
    {
      path: "/runs",
      name: "runs",
      component: RunCenterPage,
      meta: { title: "运行中心" }
    },
    {
      path: "/qa",
      name: "qa",
      component: QaCenterPage,
      meta: { title: "问答中心" }
    },
    {
      path: "/summary/confirm",
      name: "summary-confirm",
      component: SummaryConfirmPage,
      meta: { title: "总结确认" }
    },
    {
      path: "/summary/progress/:runId",
      name: "summary-progress",
      component: SummaryProgressPage,
      meta: { title: "运行进度" }
    },
    {
      path: "/reports",
      name: "reports",
      component: ReportCenterPage,
      meta: { title: "周报中心" }
    },
    {
      path: "/history",
      name: "history",
      component: HistoryPage,
      meta: { title: "历史记录" }
    },
    {
      path: "/runs/:runId",
      name: "run-detail",
      component: RunDetailPage,
      meta: { title: "运行详情" }
    },
    {
      path: "/results/:snapshotId",
      name: "item-detail",
      component: ItemDetailPage,
      meta: { title: "结果详情" }
    }
  ]
});
