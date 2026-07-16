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
    const conditionWorkflow: Pick<Condition, "disposition" | "ruleOutcome" | "auditorDisposition" | "agreementWithAuditor" | "documentationIssues" | "disabledReason"> = {
      disposition: {
        action: "Validate",
        comments: "Preserve this disposition",
        userId: "u-coder-3",
        decidedAt: "2026-07-15T09:15:00.000Z",
        agreedWithRecommendation: true,
        source: "user-selected"
      },
      ruleOutcome: {
        source: "rule-resolved",
        action: "Validate",
        ruleId: "legacy-rule",
        explanation: "Preserve this rule outcome",
        createdAt: "2026-07-15T09:16:00.000Z"
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
      ...conditionWorkflow
    });
    expect(generatedSnapshot(migrated.data)).toEqual(generatedBefore);
    expect(migrated.data.audits).toEqual(auditsBefore);
    expect(migrated.data.downstreamTasks).toEqual(tasksBefore);
    expect(migrated.data.history).toEqual(historyBefore);
    expect(migrated.data.exports).toEqual(exportsBefore);

    expect(migratePersistedState(migrated)).toEqual(migrated);
    expect(migrated.data.reviews.filter((item) => item.id === persistedReview.id)).toHaveLength(1);
  });
});
