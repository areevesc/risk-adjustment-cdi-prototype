import type { Category, ProspectiveSubtype } from "./types";
import type { DispositionSummaryLabel } from "./selectors";

export const categoryTokens: Record<Category, { label: string; color: string; bg: string; border: string }> = {
  validated: {
    label: "Validated",
    color: "#087f5b",
    bg: "#e6f7ef",
    border: "#8bd7b6"
  },
  potentialDelete: {
    label: "Potential Delete",
    color: "#b42318",
    bg: "#fff0ec",
    border: "#ffb4a2"
  },
  potentialAddition: {
    label: "Potential Addition",
    color: "#1264b3",
    bg: "#eaf4ff",
    border: "#9ccbf3"
  },
  prospective: {
    label: "CDI Recapture/Suspect",
    color: "#b45309",
    bg: "#ffedd5",
    border: "#fdba74"
  }
};

export const subtypeTokens: Record<ProspectiveSubtype, { label: string; color: string; bg: string; border: string }> = {
  recapture: {
    label: "Recapture",
    color: "#b45309",
    bg: "#ffedd5",
    border: "#fdba74"
  },
  suspect: {
    label: "Suspect",
    color: "#9a3412",
    bg: "#fff7ed",
    border: "#fed7aa"
  }
};

export const dispositionTokens: Record<DispositionSummaryLabel, { label: string; color: string; bg: string; border: string }> = {
  Validated: categoryTokens.validated,
  Deleted: {
    label: "Deleted",
    color: "#b42318",
    bg: "#fff0ec",
    border: "#ffb4a2"
  },
  "Added to Claim": {
    label: "Added to Claim",
    color: "#1264b3",
    bg: "#eaf4ff",
    border: "#9ccbf3"
  },
  "Sent to Prospective": {
    label: "Sent to Prospective",
    color: "#b45309",
    bg: "#ffedd5",
    border: "#fdba74"
  },
  "Prospective Yes": {
    label: "Routed Opportunity",
    color: "#b45309",
    bg: "#ffedd5",
    border: "#fdba74"
  },
  "Prospective No": {
    label: "Dismissed Opportunity",
    color: "#8a5a00",
    bg: "#fff5dd",
    border: "#f2c46d"
  },
  Changed: {
    label: "Code Change",
    color: "#1264b3",
    bg: "#eaf4ff",
    border: "#9ccbf3"
  },
  "Rule Suppressed": {
    label: "Rule Suppressed",
    color: "#6d55d8",
    bg: "#f1efff",
    border: "#c3bbff"
  },
  Unresolved: {
    label: "Unresolved",
    color: "#475569",
    bg: "#f1f5f9",
    border: "#cbd5e1"
  }
};
