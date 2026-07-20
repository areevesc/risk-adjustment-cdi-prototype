import { demoSeedData } from "../data/seed";
import { appendGeneratedChartForAssignee } from "../domain/generatedCharts";
import type { AppSettings, Condition, PatientReview, SeedData } from "../domain/types";
import { describe, expect, it } from "vitest";
import { migratePersistedState } from "./AppState";
import { CURRENT_CONTENT_REVISION } from "./persistence";

const settings: AppSettings = {
  recommendationMode: "simulated",
  auditSampleRate: 25,
  prototypeCurrentYear: 2026,
  sameHccValidationThreshold: 3
};

function rowsForReview<T extends { reviewId: string }>(rows: T[], reviewId: string) {
  return rows.filter((item) => item.reviewId === reviewId);
}

function generatedSnapshot(data: SeedData) {
  return {
    patients: data.patients.filter((item) => item.id.startsWith("gen-")),
    reviews: data.reviews.filter((item) => item.id.startsWith("gen-")),
    documents: data.documents.filter((item) => item.reviewId.startsWith("gen-")),
    evidence: data.evidence.filter((item) => item.reviewId.startsWith("gen-")),
    claims: data.claims.filter((item) => item.reviewId.startsWith("gen-")),
    charts: data.charts.filter((item) => item.reviewId.startsWith("gen-")),
    conditions: data.conditions.filter((item) => item.reviewId.startsWith("gen-")),
    appointments: data.appointments.filter((item) => item.id.startsWith("gen-"))
  };
}

describe("persisted clinical-content migration", () => {
  it("atomically refreshes seed bundles while preserving workflow progress and generated charts", () => {
    const reviewId = "rev-109";
    const patientId = "pat-109";
    let legacy = appendGeneratedChartForAssignee(structuredClone(demoSeedData), "u-coder-1", 2026);
    const generatedBefore = generatedSnapshot(legacy);
    const persistedReview = legacy.reviews.find((item) => item.id === reviewId)!;
    const persistedCondition = legacy.conditions.find((item) => item.id === "cond-109-a")!;

    const reviewWorkflow: Pick<PatientReview, "status" | "queue" | "assignedUserId" | "assignedAuditorId" | "coverage" | "lock" | "auditReturn"> = {
      status: "Rework Required",
      queue: "Manager Review Queue",
      assignedUserId: "u-coder-3",
      assignedAuditorId: "u-auditor-1",
      coverage: {
        originalAssignedUserId: "u-coder-2",
        coveringUserId: "u-coder-3",
        startedAt: "2026-07-15T09:00:00.000Z",
        initiatedByUserId: "u-manager-1"
      },
      lock: { lockedByUserId: "u-coder-3", lockedAt: "2026-07-15T09:05:00.000Z" },
      auditReturn: {
        auditId: "audit-rev-109",
        returnedByUserId: "u-auditor-1",
        returnedAt: "2026-07-15T09:10:00.000Z",
        comments: "Preserve this review state"
      }
    };
    const conditionWorkflow: Pick<Condition, "disposition" | "draftDisposition" | "draftProspectiveHandoff" | "ruleOutcome" | "draftRuleOutcome" | "auditorDisposition" | "agreementWithAuditor" | "documentationIssues" | "disabledReason"> = {
      disposition: {
        action: "Validate",
        comments: "Preserve this disposition",
        userId: "u-coder-3",
        decidedAt: "2026-07-15T09:15:00.000Z",
        agreedWithRecommendation: true,
        source: "user-selected"
      },
      draftDisposition: {
        action: "Delete",
        comments: "Preserve this reversible draft",
        userId: "u-coder-3",
        stagedAt: "2026-07-15T09:15:30.000Z",
        agreedWithRecommendation: false,
        source: "user-selected"
      },
      draftProspectiveHandoff: {
        targetCalendarYear: 2027,
        note: "Preserve this prospective handoff draft",
        userId: "u-coder-3",
        stagedAt: "2026-07-15T09:15:45.000Z"
      },
      ruleOutcome: {
        source: "rule-resolved",
        action: "Validate",
        ruleId: "legacy-rule",
        explanation: "Preserve this rule outcome",
        createdAt: "2026-07-15T09:16:00.000Z"
      },
      draftRuleOutcome: {
        source: "rule-suppressed",
        action: "Add to Claim",
        ruleId: "same-hcc-duplicate-add",
        explanation: "Preserve this draft rule preview",
        createdAt: "2026-07-15T09:16:30.000Z"
      },
      auditorDisposition: {
        outcome: "Agree",
        comments: "Preserve this audit decision",
        auditorId: "u-auditor-1",
        decidedAt: "2026-07-15T09:17:00.000Z",
        agreedWithUser: true,
        source: "auditor-selected"
      },
      agreementWithAuditor: true,
      documentationIssues: [{ issue: "Provider education", comments: "Preserve this flag", userId: "u-coder-3", createdAt: "2026-07-15T09:18:00.000Z" }],
      disabledReason: "Preserve this disabled reason"
    };

    legacy = {
      ...legacy,
      patients: legacy.patients.map((patient) => (patient.id === patientId ? { ...patient, name: "Stale Victor", demographicRaf: 99 } : patient)),
      reviews: legacy.reviews.map((review) => (review.id === reviewId ? { ...review, ...reviewWorkflow, conditionIds: ["stale-condition"] } : review)),
      documents: [
        ...legacy.documents.filter((item) => item.reviewId !== reviewId),
        { ...legacy.documents.find((item) => item.reviewId === reviewId)!, id: "stale-doc-rev-109", title: "Stale Pages document" }
      ],
      evidence: [
        ...legacy.evidence.filter((item) => item.reviewId !== reviewId),
        {
          ...legacy.evidence.find((item) => item.reviewId === reviewId)!,
          id: "stale-evidence-rev-109",
          documentId: "stale-doc-rev-109",
          anchorId: "missing-anchor",
          conditionIds: ["stale-condition"]
        }
      ],
      claims: legacy.claims.map((claim) => (claim.reviewId === reviewId ? { ...claim, icd10Codes: ["STALE"] } : claim)),
      charts: legacy.charts.map((chart) => (chart.reviewId === reviewId ? { ...chart, encounters: [], labs: [], vitals: [] } : chart)),
      conditions: legacy.conditions.map((condition) =>
        condition.id === persistedCondition.id
          ? { ...condition, ...conditionWorkflow, icd10: "STALE", evidenceIds: ["stale-evidence-rev-109"], hasSufficientMeat: false }
          : condition
      ),
      appointments: legacy.appointments.map((appointment) => (appointment.patientId === patientId ? { ...appointment, date: "1999-01-01" } : appointment))
    };

    const auditsBefore = structuredClone(legacy.audits);
    const tasksBefore = structuredClone(legacy.downstreamTasks);
    const historyBefore = structuredClone(legacy.history);
    const exportsBefore = structuredClone(legacy.exports);
    const migrated = migratePersistedState({ currentUserId: "u-manager-1", settings, data: legacy });

    expect(migrated.contentRevision).toBe(CURRENT_CONTENT_REVISION);
    expect(migrated.currentUserId).toBe("u-manager-1");
    expect(migrated.settings).toEqual(settings);
    expect(migrated.data.patients.find((item) => item.id === patientId)).toEqual(demoSeedData.patients.find((item) => item.id === patientId));
    expect(rowsForReview(migrated.data.documents, reviewId)).toEqual(rowsForReview(demoSeedData.documents, reviewId));
    expect(rowsForReview(migrated.data.evidence, reviewId)).toEqual(rowsForReview(demoSeedData.evidence, reviewId));
    expect(rowsForReview(migrated.data.claims, reviewId)).toEqual(rowsForReview(demoSeedData.claims, reviewId));
    expect(rowsForReview(migrated.data.charts, reviewId)).toEqual(rowsForReview(demoSeedData.charts, reviewId));
    expect(migrated.data.appointments.filter((item) => item.patientId === patientId)).toEqual(demoSeedData.appointments.filter((item) => item.patientId === patientId));

    const migratedReview = migrated.data.reviews.find((item) => item.id === reviewId)!;
    const seedReview = demoSeedData.reviews.find((item) => item.id === reviewId)!;
    expect(migratedReview).toMatchObject({
      patientId: seedReview.patientId,
      calendarYear: seedReview.calendarYear,
      reviewType: seedReview.reviewType,
      clinicId: seedReview.clinicId,
      providerId: seedReview.providerId,
      conditionIds: seedReview.conditionIds,
      ...reviewWorkflow
    });
    expect(migratedReview.appointmentId).toBe(seedReview.appointmentId);

    const migratedCondition = migrated.data.conditions.find((item) => item.id === persistedCondition.id)!;
    const seedCondition = demoSeedData.conditions.find((item) => item.id === persistedCondition.id)!;
    expect(migratedCondition).toMatchObject({
      icd10: seedCondition.icd10,
      evidenceIds: seedCondition.evidenceIds,
      hasSufficientMeat: seedCondition.hasSufficientMeat,
      ...conditionWorkflow,
      disposition: undefined
    });
    expect(generatedSnapshot(migrated.data)).toEqual(generatedBefore);
    expect(migrated.data.audits).toEqual(auditsBefore);
    expect(migrated.data.downstreamTasks).toEqual(tasksBefore);
    expect(migrated.data.history).toEqual(historyBefore);
    expect(migrated.data.exports).toEqual(exportsBefore);

    expect(migratePersistedState(migrated)).toEqual(migrated);
    expect(migrated.data.reviews.filter((item) => item.id === persistedReview.id)).toHaveLength(1);
  });

  it("migrates revision 3 generated rows to V28 metadata and COMMUNITY_NA demographics", () => {
    const legacy = appendGeneratedChartForAssignee(structuredClone(demoSeedData), "u-coder-1", 2026);
    const generatedPatient = legacy.patients.find((item) => item.id.startsWith("gen-pat-"))!;
    const generatedCondition = legacy.conditions.find((item) => item.id.startsWith("gen-cond-") && item.icd10 === "E11.22")!;
    (generatedPatient as Partial<typeof generatedPatient>).riskProfile = undefined;
    generatedPatient.demographicRaf = 99;
    generatedCondition.description = "Stale generated description";
    generatedCondition.hcc = "HCC 328";
    generatedCondition.raf = 99;
    generatedCondition.trumpedByCode = "STALE";

    const migrated = migratePersistedState({ contentRevision: 3, currentUserId: "u-coder-1", settings, data: legacy });
    const patient = migrated.data.patients.find((item) => item.id === generatedPatient.id)!;
    const condition = migrated.data.conditions.find((item) => item.id === generatedCondition.id)!;

    expect(patient.riskProfile).toMatchObject({ segment: "COMMUNITY_NA", originallyDisabled: false });
    expect(patient.demographicRaf).not.toBe(99);
    expect(condition).toMatchObject({
      description: "Type 2 diabetes mellitus with diabetic chronic kidney disease",
      program: "risk-adjustment",
      hcc: "HCC 37",
      raf: 0.166,
      trumpedByCode: undefined
    });
  });

  it("converts unfinished legacy decisions into reversible drafts without premature action records", () => {
    const legacy = structuredClone(demoSeedData);
    const reviewId = "rev-110";
    const conditionId = "cond-110-a";
    legacy.reviews = legacy.reviews.map((review) =>
      review.id === reviewId ? { ...review, status: "In Progress", lock: { lockedByUserId: "u-coder-1", lockedAt: "2026-07-19T10:00:00.000Z" } } : review
    );
    legacy.conditions = legacy.conditions.map((condition) =>
      condition.id === conditionId
        ? {
            ...condition,
            disposition: {
              action: "Validate",
              userId: "u-coder-1",
              decidedAt: "2026-07-19T10:05:00.000Z",
              agreedWithRecommendation: true,
              source: "user-selected"
            }
          }
        : condition
    );
    legacy.downstreamTasks.push({
      id: "legacy-task",
      reviewId,
      conditionId,
      type: "Deletion",
      status: "Open",
      queue: "Export List",
      createdByUserId: "u-coder-1",
      createdAt: "2026-07-19T10:05:00.000Z"
    });
    legacy.history.unshift({
      id: "legacy-action-history",
      reviewId,
      conditionId,
      userId: "u-coder-1",
      at: "2026-07-19T10:05:00.000Z",
      event: "Action selected",
      detail: "Validate"
    });

    const migrated = migratePersistedState({ contentRevision: 5, currentUserId: "u-coder-1", settings, data: legacy });
    const condition = migrated.data.conditions.find((item) => item.id === conditionId)!;
    expect(condition.disposition).toBeUndefined();
    expect(condition.draftDisposition).toMatchObject({ action: "Validate", stagedAt: "2026-07-19T10:05:00.000Z", userId: "u-coder-1" });
    expect(migrated.data.downstreamTasks.some((task) => task.id === "legacy-task")).toBe(false);
    expect(migrated.data.history.some((entry) => entry.id === "legacy-action-history")).toBe(false);
  });

  it("migrates an unfinished legacy Send to Prospective selection into the independent handoff draft", () => {
    const legacy = structuredClone(demoSeedData);
    const reviewId = "rev-102";
    const conditionId = "cond-102-a";
    legacy.conditions = legacy.conditions.map((condition) =>
      condition.id === conditionId
        ? {
            ...condition,
            draftDisposition: {
              action: "Send to Prospective",
              comments: "Carry this forward",
              userId: "u-coder-3",
              stagedAt: "2026-07-19T10:05:00.000Z",
              source: "user-selected"
            }
          }
        : condition
    );

    const migrated = migratePersistedState({ contentRevision: 7, currentUserId: "u-coder-3", settings, data: legacy });
    const condition = migrated.data.conditions.find((item) => item.id === conditionId)!;
    expect(condition.draftDisposition).toBeUndefined();
    expect(condition.draftProspectiveHandoff).toMatchObject({
      targetCalendarYear: 2026,
      note: "Carry this forward",
      userId: "u-coder-3",
      stagedAt: "2026-07-19T10:05:00.000Z"
    });
  });
});
