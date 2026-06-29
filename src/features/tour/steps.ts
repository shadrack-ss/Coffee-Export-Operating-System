import type { Step } from "react-joyride";

export const TOUR_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "Welcome to CE-OS",
    content:
      "CE-OS manages your entire coffee export operation — from green bean intake through processing, costing, and shipment. This quick tour will show you the key modules.",
  },
  {
    target: "#tour-sidebar",
    placement: "right",
    disableBeacon: true,
    title: "Navigation",
    content:
      "All modules live here. Your role controls which items are visible — operators see batches and processing; finance staff see expenses and forex; admins see everything.",
  },
  {
    target: "#tour-forex-ticker",
    placement: "bottom",
    disableBeacon: true,
    title: "Live exchange rate",
    content:
      "The USD/UGX rate is always visible here. It's pulled automatically from URA daily and used for customs-compliant valuations across the system.",
  },
  {
    target: "#tour-kpi-cards",
    placement: "bottom",
    disableBeacon: true,
    title: "Dashboard",
    content:
      "Live summary of active batches, total value in UGX, and margin risk. Alerts appear here when rates shift or approvals are pending.",
  },
  {
    target: "#tour-nav-batches",
    placement: "right",
    disableBeacon: true,
    title: "Batches",
    content:
      "A batch is a coffee purchase. Start here when coffee arrives — record the supplier, weight, grade, and GRNs (Goods Received Notes). Everything else flows from a batch.",
  },
  {
    target: "#tour-nav-processing",
    placement: "right",
    disableBeacon: true,
    title: "Processing",
    content:
      "Log milling, sorting, and bagging runs. The system re-costs the batch automatically as weight is lost, keeping your cost-per-kg accurate at every stage.",
  },
  {
    target: "#tour-nav-expenses",
    placement: "right",
    disableBeacon: true,
    title: "Expenses",
    content:
      "Add freight, insurance, handling, and other charges. Expenses roll into the landed cost calculation shown on each batch's detail page.",
  },
  {
    target: "#tour-nav-forex",
    placement: "right",
    disableBeacon: true,
    title: "Forex",
    content:
      "View rate history and lock the URA Exports rate to a specific batch before shipment. Locked rates are used for customs valuation and cannot be changed after locking.",
  },
  {
    target: "#tour-nav-traceability",
    placement: "right",
    disableBeacon: true,
    title: "Traceability",
    content:
      "Full farm-to-export audit trail. Track certifications, lot splits, and chain of custody for each batch — required for most international buyers.",
  },
  {
    target: "#tour-nav-documents",
    placement: "right",
    disableBeacon: true,
    title: "Documents",
    content:
      "Generate and print export documents — packing lists, commercial invoices, and certificates — directly from the system data.",
  },
  {
    target: "#tour-user-menu",
    placement: "bottom-end",
    disableBeacon: true,
    title: "You're all set",
    content:
      "That covers the core workflow. You can relaunch this tour anytime from the user menu here.",
  },
];
