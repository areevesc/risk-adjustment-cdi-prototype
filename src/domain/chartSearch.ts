import type { ChartTab, ClinicalChart } from "./types";
import { formatDate } from "./format";

export interface ChartSearchResult {
  id: string;
  tab: ChartTab;
  itemId: string;
  parentId?: string;
  sectionId?: string;
  sourceLabel: string;
  sectionLabel: string;
  preview: string;
  matchCount: number;
}

type SearchValue = string | number | undefined;

interface SearchCandidate extends Omit<ChartSearchResult, "id" | "matchCount" | "preview"> {
  searchValues: SearchValue[];
  previewValues?: SearchValue[];
}

const PREVIEW_LENGTH = 180;
const PREVIEW_CONTEXT = 48;

export function normalizeChartSearchQuery(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function compactSearchValue(value: SearchValue): string {
  return value === undefined ? "" : String(value).trim().replace(/\s+/g, " ");
}

function countMatches(value: SearchValue, query: string): number {
  const searchableValue = normalizeChartSearchQuery(compactSearchValue(value));
  let count = 0;
  let fromIndex = 0;

  while (fromIndex <= searchableValue.length - query.length) {
    const matchIndex = searchableValue.indexOf(query, fromIndex);
    if (matchIndex === -1) break;
    count += 1;
    fromIndex = matchIndex + query.length;
  }

  return count;
}

function buildPreview(values: SearchValue[], query: string): string {
  const compactValues = values.map(compactSearchValue).filter(Boolean);
  const matchingValue = compactValues.find((value) => normalizeChartSearchQuery(value).includes(query));
  const value = matchingValue ?? compactValues[0] ?? "";
  const normalizedValue = normalizeChartSearchQuery(value);
  const matchIndex = normalizedValue.indexOf(query);

  if (value.length <= PREVIEW_LENGTH) return value;

  const preferredStart = matchIndex === -1 ? 0 : Math.max(0, matchIndex - PREVIEW_CONTEXT);
  const start = Math.min(preferredStart, value.length - PREVIEW_LENGTH);
  const end = Math.min(value.length, start + PREVIEW_LENGTH);
  return `${start > 0 ? "…" : ""}${value.slice(start, end).trim()}${end < value.length ? "…" : ""}`;
}

function buildResultId(candidate: SearchCandidate): string {
  return [candidate.tab, candidate.parentId ?? "", candidate.itemId, candidate.sectionId ?? ""]
    .map((part) => encodeURIComponent(part))
    .join("|");
}

function appendMatchingCandidate(results: ChartSearchResult[], candidate: SearchCandidate, query: string): void {
  const matchCount = candidate.searchValues.reduce<number>((total, value) => total + countMatches(value, query), 0);
  if (matchCount === 0) return;

  results.push({
    id: buildResultId(candidate),
    tab: candidate.tab,
    itemId: candidate.itemId,
    parentId: candidate.parentId,
    sectionId: candidate.sectionId,
    sourceLabel: candidate.sourceLabel,
    sectionLabel: candidate.sectionLabel,
    preview: buildPreview(candidate.previewValues ?? candidate.searchValues, query),
    matchCount
  });
}

function vitalSummary(vital: ClinicalChart["vitals"][number]): string {
  return [
    `Date ${formatDate(vital.date)}`,
    `BP ${vital.systolic}/${vital.diastolic}`,
    `HR ${vital.heartRate}`,
    `Temperature ${vital.temperature} F`,
    `Weight ${vital.weight} lb`,
    `Height ${vital.height} in`,
    `BMI ${vital.bmi}`,
    `O2 saturation ${vital.oxygenSaturation}%`
  ].join(" · ");
}

export function buildChartSearchResults(chart: ClinicalChart, query: string): ChartSearchResult[] {
  const normalizedQuery = normalizeChartSearchQuery(query);
  if (!normalizedQuery) return [];

  const results: ChartSearchResult[] = [];
  const add = (candidate: SearchCandidate) => appendMatchingCandidate(results, candidate, normalizedQuery);

  chart.encounters.forEach((encounter) => {
    const sourceLabel = `${formatDate(encounter.date)} · ${encounter.type} · ${encounter.provider}`;
    const parentId = encounter.id;

    add({
      tab: "encounters",
      parentId,
      itemId: encounter.id,
      sectionId: "chiefComplaint",
      sourceLabel,
      sectionLabel: "Chief Complaint",
      searchValues: [encounter.date, formatDate(encounter.date), encounter.type, encounter.provider, encounter.quality, encounter.chiefComplaint],
      previewValues: [encounter.chiefComplaint, sourceLabel]
    });
    add({
      tab: "encounters",
      parentId,
      itemId: encounter.id,
      sectionId: "hpi",
      sourceLabel,
      sectionLabel: "History of Present Illness",
      searchValues: [encounter.hpi]
    });
    add({
      tab: "encounters",
      parentId,
      itemId: encounter.id,
      sectionId: "ros",
      sourceLabel,
      sectionLabel: "Review of Systems",
      searchValues: encounter.reviewOfSystems,
      previewValues: [encounter.reviewOfSystems.join(" · ")]
    });
    add({
      tab: "encounters",
      parentId,
      itemId: encounter.vitals.id,
      sectionId: "vitals",
      sourceLabel,
      sectionLabel: "Vitals",
      searchValues: [encounter.vitals.date, vitalSummary(encounter.vitals)]
    });
    add({
      tab: "encounters",
      parentId,
      itemId: encounter.id,
      sectionId: "physicalExam",
      sourceLabel,
      sectionLabel: "Physical Exam",
      searchValues: encounter.physicalExam.flatMap((item) => [item.system, item.text]),
      previewValues: [encounter.physicalExam.map((item) => `${item.system}: ${item.text}`).join(" · ")]
    });

    encounter.assessmentPlan.forEach((plan) => {
      add({
        tab: "encounters",
        parentId,
        itemId: plan.id,
        sectionId: "assessmentPlan",
        sourceLabel,
        sectionLabel: `Assessment & Plan · ${plan.problem}`,
        searchValues: [plan.problem, plan.code, plan.detail],
        previewValues: [`${plan.problem}${plan.code ? ` (${plan.code})` : ""}: ${plan.detail}`]
      });
    });

    add({
      tab: "encounters",
      parentId,
      itemId: encounter.id,
      sectionId: "billing",
      sourceLabel,
      sectionLabel: "Billing & Signature",
      searchValues: [encounter.billingCode, encounter.signatureTime, encounter.provider],
      previewValues: [`Billing code ${encounter.billingCode} · Signed by ${encounter.provider} at ${encounter.signatureTime}`]
    });
  });

  chart.problems.forEach((problem) => {
    const hccLabel = problem.isHcc ? "HCC: Yes" : "HCC: No";
    add({
      tab: "problem-list",
      itemId: problem.id,
      sourceLabel: "Problem List",
      sectionLabel: problem.diagnosis,
      searchValues: [problem.diagnosis, problem.code, problem.status, problem.dateAdded, hccLabel],
      previewValues: [`${problem.diagnosis} (${problem.code}) · ${problem.status} · Added ${problem.dateAdded} · ${hccLabel}`]
    });
  });

  chart.pastMedicalHistory.forEach((item) => {
    add({
      tab: "pmh",
      itemId: item.id,
      sourceLabel: "Past Medical History",
      sectionLabel: "History Item",
      searchValues: [item.text]
    });
  });

  chart.medications.forEach((medication) => {
    add({
      tab: "medications",
      itemId: medication.id,
      sourceLabel: "Medication List",
      sectionLabel: medication.name,
      searchValues: [medication.name, medication.dose, medication.frequency, medication.route, medication.prescriber],
      previewValues: [`${medication.name} · ${medication.dose} · ${medication.frequency} · ${medication.route} · ${medication.prescriber}`]
    });
  });

  chart.labs.forEach((panel) => {
    const sourceLabel = `${panel.name} · ${formatDate(panel.date)}`;
    add({
      tab: "labs",
      parentId: panel.id,
      itemId: panel.id,
      sourceLabel,
      sectionLabel: "Panel",
      searchValues: [panel.name, panel.date, formatDate(panel.date)],
      previewValues: [sourceLabel]
    });

    panel.results.forEach((result) => {
      add({
        tab: "labs",
        parentId: panel.id,
        itemId: result.id,
        sourceLabel,
        sectionLabel: result.component,
        searchValues: [result.component, result.value, result.unit, result.referenceRange, result.flag],
        previewValues: [`${result.component} · ${result.value} ${result.unit} · Reference ${result.referenceRange} · ${result.flag}`]
      });
    });
  });

  chart.vitals.forEach((vital) => {
    add({
      tab: "vitals",
      itemId: vital.id,
      sourceLabel: `Vitals · ${formatDate(vital.date)}`,
      sectionLabel: "Vital Signs",
      searchValues: [vital.date, vitalSummary(vital)]
    });
  });

  chart.imaging.forEach((report) => {
    const sourceLabel = `${report.type} · ${formatDate(report.date)}`;
    add({
      tab: "imaging",
      parentId: report.id,
      itemId: report.id,
      sectionId: "indication",
      sourceLabel,
      sectionLabel: "Indication",
      searchValues: [report.type, report.date, formatDate(report.date), report.indication],
      previewValues: [report.indication, sourceLabel]
    });
    add({
      tab: "imaging",
      parentId: report.id,
      itemId: report.id,
      sectionId: "findings",
      sourceLabel,
      sectionLabel: "Findings",
      searchValues: [report.findings]
    });
    add({
      tab: "imaging",
      parentId: report.id,
      itemId: report.id,
      sectionId: "impression",
      sourceLabel,
      sectionLabel: "Impression",
      searchValues: report.impression,
      previewValues: [report.impression.join(" · ")]
    });
  });

  chart.specialistNotes.forEach((note) => {
    const sourceLabel = `${note.title} · ${note.specialty} · ${note.provider} · ${formatDate(note.date)}`;
    add({
      tab: "specialist-notes",
      parentId: note.id,
      itemId: note.id,
      sectionId: "note",
      sourceLabel,
      sectionLabel: "Specialist Note",
      searchValues: [note.title, note.specialty, note.provider, note.date, formatDate(note.date), note.note],
      previewValues: [note.note, sourceLabel]
    });
    add({
      tab: "specialist-notes",
      parentId: note.id,
      itemId: note.id,
      sectionId: "assessment",
      sourceLabel,
      sectionLabel: "Assessment",
      searchValues: note.assessment,
      previewValues: [note.assessment.join(" · ")]
    });
  });

  chart.claims.forEach((claim) => {
    const sourceLabel = `${formatDate(claim.dateOfService)} · ${claim.provider ?? "Unknown provider"}`;
    const eligibility = [
      claim.riskEligible ? "Risk eligible" : "Risk ineligible",
      claim.cptSourceEligible ? "CPT source eligible" : "CPT source ineligible",
      claim.providerTypeEligible ? "Provider type eligible" : "Provider type ineligible",
      claim.faceToFace ? "Face-to-face" : "Non-face-to-face",
      claim.providerSignatureValid ? "Signature valid" : "Signature invalid"
    ].join(" · ");
    const codeSummary = claim.icd10Codes.length ? claim.icd10Codes.join(", ") : "No diagnosis codes";

    add({
      tab: "claims",
      parentId: claim.id,
      itemId: claim.id,
      sourceLabel,
      sectionLabel: "Claim",
      searchValues: [
        claim.dateOfService,
        formatDate(claim.dateOfService),
        claim.provider,
        claim.cptCode,
        claim.encounterType,
        claim.payer,
        ...claim.icd10Codes,
        claim.supportSummary,
        eligibility
      ],
      previewValues: [
        claim.supportSummary,
        `${claim.cptCode ?? "No CPT"} · ${claim.encounterType ?? "Unknown encounter type"} · ICD-10 ${codeSummary}`,
        `${sourceLabel} · ${claim.payer ?? "Unknown payer"}`,
        eligibility
      ]
    });
  });

  return results;
}
