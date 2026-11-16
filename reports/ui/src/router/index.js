import Vue from "vue";
import VueRouter from "vue-router";
import ContentView from "../views/ContentView.vue";

Vue.use(VueRouter);

const routes = [
  { path: "/", redirect: "/queue" },

  /* Queue views*/
  {
    path: "/queue",
    name: "QueueDashboard",
    component: ContentView,
    meta: {
      name: "menu.dashboard",
      parent: "",
      section: "dashboard",
      view: "default",
      report: "queue",
      tags: ["dashboard", "calls", "agent", "hour", "answer", "lost", "done", "ivr", "choices", "unique", "caller", "total"],
    },
  },
  {
    path: "/queue/data/summary",
    name: "QueueDataSummary",
    component: ContentView,
    meta: {
      name: "data.summary",
      parent: "data",
      section: "data",
      view: "summary",
      report: "queue",
      tags: ["summary", "good", "failed", "timeout", "exitempty", "exitkey", "full", "joinempty", "null", "agent"],
    },
  },
  {
    path: "/queue/data/agent",
    name: "QueueDataAgent",
    component: ContentView,
    meta: {
      name: "data.by_agent",
      parent: "data",
      section: "data",
      view: "agent",
      report: "queue",
      tags: ["agent"],
    },
  },
  {
    path: "/queue/data/session",
    name: "QueueDataSession",
    component: ContentView,
    meta: {
      name: "data.by_session",
      parent: "data",
      section: "data",
      view: "session",
      report: "queue",
      tags: ["session"],
    },
  },
  {
    path: "/queue/data/caller",
    name: "QueueDataCaller",
    component: ContentView,
    meta: {
      name: "data.by_caller",
      parent: "data",
      section: "data",
      view: "caller",
      report: "queue",
      tags: ["caller"],
    },
  },
  {
    path: "/queue/data/call",
    name: "QueueDataCall",
    component: ContentView,
    meta: {
      name: "data.by_call",
      parent: "data",
      section: "data",
      view: "call",
      report: "queue",
      tags: ["call"],
    },
  },
  {
    path: "/queue/data/lost_call",
    name: "QueueDataLostCall",
    component: ContentView,
    meta: {
      name: "data.by_lost_call",
      parent: "data",
      section: "data",
      view: "lost_call",
      report: "queue",
      tags: ["lost call"],
    },
  },
  {
    path: "/queue/data/ivr",
    name: "QueueDataIVR",
    component: ContentView,
    meta: {
      name: "data.ivr",
      parent: "data",
      section: "data",
      view: "ivr",
      report: "queue",
      tags: ["ivr"],
    },
  },
  {
    path: "/queue/performance",
    name: "QueuePerformance",
    component: ContentView,
    meta: {
      name: "menu.performance",
      parent: "performance",
      section: "performance",
      view: "default",
      report: "queue",
      tags: ["performance", "qos", "quality", "talk time", "time"],
    },
  },
  {
    path: "/queue/distribution/hour",
    name: "QueueDistributionHour",
    component: ContentView,
    meta: {
      name: "distribution.by_hour",
      parent: "distribution",
      section: "distribution",
      view: "hourly",
      report: "queue",
      tags: ["hourly", "good", "failed", "timeout", "exitempty", "exitkey", "full", "joinempty", "null", "agent", "ivr"],
    },
  },
  {
    path: "/queue/distribution/geo",
    name: "QueueDistributionGeo",
    component: ContentView,
    meta: {
      name: "distribution.by_geo",
      parent: "distribution",
      section: "distribution",
      view: "geographic",
      report: "queue",
      tags: ["geographic"],
    },
  },
  {
    path: "/queue/graphs/load",
    name: "QueueGraphsLoad",
    component: ContentView,
    meta: {
      name: "graphs.load",
      parent: "graphs",
      section: "graphs",
      view: "load",
      report: "queue",
      tags: ["load", "geographic"],
    },
  },
  {
    path: "/queue/graphs/hour",
    name: "QueueGraphsHour",
    component: ContentView,
    meta: {
      name: "graphs.by_hour",
      parent: "graphs",
      section: "graphs",
      view: "hour",
      report: "queue",
      tags: ["hour", "good", "failed", "timeout", "exitempty", "exitkey", "full", "joinempty", "null", "agent", "ivr"],
    },
  },
  {
    path: "/queue/graphs/agent",
    name: "QueueGraphsAgent",
    component: ContentView,
    meta: {
      name: "graphs.by_agent",
      parent: "graphs",
      section: "graphs",
      view: "agent",
      report: "queue",
      tags: ["agent", "answer", "no answer", "lost", "done", "queue"],
    },
  },
  {
    path: "/queue/graphs/area",
    name: "QueueGraphsArea",
    component: ContentView,
    meta: {
      name: "graphs.by_area",
      parent: "graphs",
      section: "graphs",
      view: "area",
      report: "queue",
      tags: ["area", "district", "area code", "province", "region"],
    },
  },
  {
    path: "/queue/graphs/queue_position",
    name: "QueueGraphsQueuePosition",
    component: ContentView,
    meta: {
      name: "graphs.queue_position",
      parent: "graphs",
      section: "graphs",
      view: "queue_position",
      report: "queue",
      tags: ["queue", "position"],
    },
  },
  {
    path: "/queue/graphs/avg_duration",
    name: "QueueGraphsAvgDuration",
    component: ContentView,
    meta: {
      name: "graphs.average_duration",
      parent: "graphs",
      section: "graphs",
      view: "avg_duration",
      report: "queue",
      tags: ["avg", "average", "duration"],
    },
  },
  {
    path: "/queue/graphs/avg_wait",
    name: "QueueGraphsAvgWait",
    component: ContentView,
    meta: {
      name: "graphs.average_wait",
      parent: "graphs",
      section: "graphs",
      view: "avg_wait",
      report: "queue",
      tags: ["avg", "average", "wait"],
    },
  },
  {
    path: "/queue/graphs/recall",
    name: "QueueGraphsRecall",
    component: ContentView,
    meta: {
      name: "graphs.recall",
      parent: "graphs",
      section: "graphs",
      view: "recall",
      report: "queue",
      tags: ["recall"],
    }
  },

  /* CDR views*/
  {
    path: "/cdr",
    name: "CdrDashboard",
    component: ContentView,
    meta: {
      name: "menu.dashboard",
      parent: "",
      section: "dashboard",
      view: "default",
      report: "cdr",
      tags: ["dashboard"],
    },
  },
  {
    path: "/cdr/pbx/inbound",
    name: "PbxDataIncoming",
    component: ContentView,
    meta: {
      name: "menu.inbound",
      parent: "pbx",
      section: "pbx",
      view: "inbound",
      report: "cdr",
      tags: ["pbx", "incoming", "inbound"],
    },
  },
  {
    path: "/cdr/pbx/outbound",
    name: "PbxDataOutgoing",
    component: ContentView,
    meta: {
      name: "menu.outbound",
      parent: "pbx",
      section: "pbx",
      view: "outbound",
      report: "cdr",
      tags: ["pbx", "outgoing", "outbound"],
    },
  },
  {
    path: "/cdr/pbx/local",
    name: "PbxDataInternal",
    component: ContentView,
    meta: {
      name: "menu.local",
      parent: "pbx",
      section: "pbx",
      view: "local",
      report: "cdr",
      tags: ["pbx", "internal", "local"],
    }
  },
  {
    path: "/cdr/personal/inbound",
    name: "PersonalDataIncoming",
    component: ContentView,
    meta: {
      name: "menu.inbound",
      parent: "personal",
      section: "personal",
      view: "inbound",
      report: "cdr",
      tags: ["personal", "incoming", "inbound"],
    }
  },
  {
    path: "/cdr/personal/outbound",
    name: "PersonalDataOutgoing",
    component: ContentView,
    meta: {
      name: "menu.outbound",
      parent: "personal",
      section: "personal",
      view: "outbound",
      report: "cdr",
      tags: ["personal", "outgoing", "outbound"],
    }
  },
  {
    path: "/cdr/personal/local",
    name: "PersonalDataInternal",
    component: ContentView,
    meta: {
      name: "menu.local",
      parent: "personal",
      section: "personal",
      view: "local",
      report: "cdr",
      tags: ["personal", "internal", "local"],
    }
  }
];

const router = new VueRouter({
  routes,
});

export default router;
