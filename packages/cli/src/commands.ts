import { PACKAGE_VERSION } from "@clalit/core";

export const VERSION = PACKAGE_VERSION;

export interface Command {
  usage: string;
  summary: string;
  description: string;
  options: string[];
  notes?: string;
}

export const COMMANDS: Record<string, Command> = {
  login: {
    usage: "login [--id ID] [--port PORT] [--no-open]",
    summary: "Browser CAPTCHA + SMS OTP sign-in (own machine).",
    description:
      "Sign in to Clalit e-services on this machine via a loopback browser page (127.0.0.1). You enter Israeli ID, CAPTCHA, and SMS OTP in the browser. Nothing is solved automatically. Session cookies are stored locally.",
    options: ["id", "port", "no-open"],
    notes:
      "Requires residential/user IP. Datacenter hosts hit Imperva Error 16. No bot / Imperva / CAPTCHA bypass. `--http` is accepted as a no-op alias.",
  },
  logout: {
    usage: "logout",
    summary: "Delete the local session file.",
    description: "Removes saved cookies from the config directory. Does not call upstream logout.",
    options: [],
  },
  labs: {
    usage: "labs [--from DATE] [--to DATE] [--json]",
    summary: "List own laboratory history rows.",
    description: "Reads LabsTestList.aspx for the authenticated owner only.",
    options: ["from", "to", "json"],
    notes: "Date format is dd.MM.yyyy. listLabs walks every pager page. Never switches family members.",
  },
  lab: {
    usage: "lab --ref TOKEN [--json]",
    summary: "Read one lab result detail.",
    description: "Fetches LabTestDetails.aspx using a ref token from `labs`.",
    options: ["ref", "json"],
  },
  "lab-document": {
    usage: "lab-document --ref TOKEN --out FILE",
    summary: "Download the lab result PDF.",
    description: "POSTs the detail page download control and writes PDF bytes.",
    options: ["ref", "out"],
  },
  prescriptions: {
    usage: "prescriptions [--from DATE] [--to DATE] [--include-expired] [--json]",
    summary: "List own prescriptions (מרשמים).",
    description: "Reads PatientPrescriptionsex.aspx for the authenticated owner only.",
    options: ["from", "to", "include-expired", "json"],
    notes: "No PDF/print. listPrescriptions walks every gridPager page. Never switches family members.",
  },
  "prescription-status": {
    usage:
      "prescription-status --prescription NO --medication ID --form NAME --start DATE --section ID [--json]",
    summary: "Read pharmacy issue status for one medicine row.",
    description:
      "POSTs IssueDrugsByPatientReceiptId with values from a prescriptions list row (read status only).",
    options: ["prescription", "medication", "form", "start", "section", "json"],
    notes: "Never invent keys/values. Not a purchase write.",
  },
  "lab-orders": {
    usage: "lab-orders [--json]",
    summary: "List own lab orders (הפניות לבדיקות מעבדה).",
    description: "Reads LabOrderList.aspx for the authenticated owner only. Not MedicalReferrals.",
    options: ["json"],
  },
  "lab-order": {
    usage: "lab-order --ref TOKEN [--json]",
    summary: "Read one lab-order detail.",
    description: "Fetches LabOrderDetails.aspx?ord= using a ref token from `lab-orders`.",
    options: ["ref", "json"],
    notes: "No PDF/print download.",
  },
  documents: {
    usage: "documents --source SOURCE [--from DATE] [--to DATE] [--json]",
    summary: "List own PDF documents from one source (visit/hospital summaries, …).",
    description:
      "Searches a document source's full date range (or --from/--to, dd.MM.yyyy) and lists rows with ref tokens.",
    options: ["source", "from", "to", "json"],
    notes: "Sources: visit_summaries, hospital_summaries, medical_approvals, form17. hospital_summaries searches each hospital in turn.",
  },
  document: {
    usage: "document --ref TOKEN --out FILE",
    summary: "Download one document PDF.",
    description: "Fetches the PDF for a ref token from `documents`.",
    options: ["ref", "out"],
  },
  "download-documents": {
    usage: "download-documents --out DIR [--source SOURCE]",
    summary: "Download every document into DIR, with an index.csv.",
    description:
      "Saves DIR/<source>/yyyy-MM-dd - <details>.pdf for every document source and lab result PDF (or one source; `labs` for lab PDFs), plus DIR/index.csv.",
    options: ["out", "source"],
  },
  "refresh-session": {
    usage: "refresh-session",
    summary: "Optional soft keep-alive via RefreshSession.aspx.",
    description: "Hits the observed keep-alive endpoint. Does not extend beyond portal policy.",
    options: [],
  },
  mcp: {
    usage: "mcp",
    summary: "Run the stdio MCP server.",
    description:
      "Exposes list_labs, get_lab_result, get_lab_document, list_prescriptions, get_prescription_issue_status, list_lab_orders, get_lab_order, list_documents, get_document for local agents.",
    options: [],
  },
  help: {
    usage: "help [COMMAND]",
    summary: "Show help.",
    description: "Print command index or one command's reference.",
    options: [],
  },
};

export function help(name?: string): string {
  if (name && COMMANDS[name]) {
    const c = COMMANDS[name]!;
    return [
      `Usage: clalit-mcp ${c.usage}`,
      "",
      c.description,
      c.notes ? `\nNotes: ${c.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const lines = [
    `clalit-mcp ${VERSION} — own-account Clalit reads (unofficial)`,
    "",
    "Commands:",
    ...Object.entries(COMMANDS).map(([k, c]) => `  ${k.padEnd(20)} ${c.summary}`),
    "",
    "Unaffiliated with Clalit. Own records only. No CAPTCHA/Imperva bypass.",
  ];
  return lines.join("\n");
}
