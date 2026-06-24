import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, Lock, Play, Search, UserPlus } from "lucide-react";
import { useAppState } from "../../state/AppState";
import {
  byId,
  getPersonalStats,
  getPresentedOpportunitySummary,
  getProspectiveCounts,
  getReviewScenarioTags,
  isAssignedToUser
} from "../../domain/selectors";
import type { PatientReview, WorkflowStatus } from "../../domain/types";
import { formatDate } from "../../domain/format";
import { Button, IconForStatus, Panel, StatusChip } from "../../ui/Primitives";
import { categoryTokens } from "../../domain/tokens";
import { canTakeCoverage, getVisibleReviews } from "../../domain/auth";

interface QueueRow {
  review: PatientReview;
  patient: string;
  dob: string;
  memberId: string;
  payer: string;
  clinic: string;
  provider: string;
  year: number;
  type: string;
  assigned: string;
  status: WorkflowStatus;
  queue: string;
  lockedBy: string;
  categories: ReturnType<typeof getPresentedOpportunitySummary>;
  recapture: number;
  suspect: number;
  sourceExamples: string[];
  noVisit: boolean;
}

const columnHelper = createColumnHelper<QueueRow>();

export function QueuePage() {
  const { data, currentUser, actions } = useAppState();
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([{ id: "status", desc: false }]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [reviewTypeFilter, setReviewTypeFilter] = useState("All");
  const [teamMemberFilter, setTeamMemberFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceExampleFilter, setSourceExampleFilter] = useState("All");
  const [noVisitOnly, setNoVisitOnly] = useState(false);

  const maps = useMemo(
    () => ({
      patients: byId(data.patients),
      payers: byId(data.payers),
      clinics: byId(data.clinics),
      providers: byId(data.providers),
      users: byId(data.users),
      appointments: new Set(data.appointments.map((appt) => appt.patientId))
    }),
    [data]
  );

  const rows = useMemo<QueueRow[]>(() => {
    return getVisibleReviews(data, currentUser).map((review) => {
      const patient = maps.patients.get(review.patientId)!;
      const assignedUsers = [review.assignedCoderId, review.assignedCdiId, review.assignedAuditorId]
        .map((id) => (id ? maps.users.get(id)?.name : undefined))
        .filter(Boolean)
        .join(" / ");
      const categories = getPresentedOpportunitySummary(data, review);
      const counts = getProspectiveCounts(data, review);
      return {
        review,
        patient: patient.name,
        dob: formatDate(patient.dob),
        memberId: patient.memberId,
        payer: maps.payers.get(patient.payerId)?.name ?? "-",
        clinic: maps.clinics.get(review.clinicId)?.name ?? "-",
        provider: maps.providers.get(review.providerId)?.name ?? "-",
        year: review.calendarYear,
        type: review.reviewType,
        assigned: assignedUsers || "Unassigned",
        status: review.status,
        queue: review.queue,
        lockedBy: review.lock ? maps.users.get(review.lock.lockedByUserId)?.name ?? "Unknown user" : "",
        categories,
        recapture: counts.recapture,
        suspect: counts.suspect,
        sourceExamples: getReviewScenarioTags(data, review),
        noVisit: !maps.appointments.has(patient.id)
      };
    });
  }, [currentUser, data, maps]);

  const sourceExampleOptions = useMemo(() => Array.from(new Set(rows.flatMap((row) => row.sourceExamples))).sort((a, b) => a.localeCompare(b)), [rows]);

  const filteredRows = rows.filter((row) => {
    const search = query.trim().toLowerCase();
    const matchesSearch =
      !search ||
      [row.patient, row.memberId, row.payer, row.clinic, row.provider, row.assigned, row.queue].some((field) => field.toLowerCase().includes(search));
    const matchesStatus = statusFilter === "All" || row.status === statusFilter;
    const matchesType = reviewTypeFilter === "All" || row.type === reviewTypeFilter;
    const matchesMember =
      teamMemberFilter === "All" ||
      row.review.assignedCoderId === teamMemberFilter ||
      row.review.assignedCdiId === teamMemberFilter ||
      row.review.assignedAuditorId === teamMemberFilter;
    const matchesCategory = categoryFilter === "All" || row.categories[categoryFilter as keyof typeof row.categories]?.count > 0;
    const matchesSourceExample = sourceExampleFilter === "All" || row.sourceExamples.includes(sourceExampleFilter);
    const matchesVisit = !noVisitOnly || row.noVisit;
    return matchesSearch && matchesStatus && matchesType && matchesMember && matchesCategory && matchesSourceExample && matchesVisit;
  });

  const personalStats = getPersonalStats(data, currentUser);

  function clearFilters() {
    setQuery("");
    setStatusFilter("All");
    setReviewTypeFilter("All");
    setTeamMemberFilter("All");
    setCategoryFilter("All");
    setSourceExampleFilter("All");
    setNoVisitOnly(false);
  }

  function open(reviewId: string) {
    actions.openReview(reviewId);
    navigate(`/review/${reviewId}`);
  }

  function nextPatient() {
    const next = filteredRows.find((row) => !row.review.lock && ["Available", "Pended"].includes(row.review.status));
    if (next) open(next.review.id);
  }

  const columns = [
    columnHelper.accessor("patient", {
      header: "Patient",
      cell: (info) => (
        <div className="patient-cell">
          <strong>{info.row.original.patient}</strong>
          <span>
            {info.row.original.dob} - {info.row.original.memberId}
          </span>
          {info.row.original.sourceExamples.length ? <ScenarioTagList tags={info.row.original.sourceExamples} limit={3} /> : null}
        </div>
      )
    }),
    columnHelper.accessor("payer", { header: "Payer" }),
    columnHelper.accessor("clinic", { header: "Clinic" }),
    columnHelper.accessor("provider", { header: "Provider" }),
    columnHelper.accessor("year", { header: "CY" }),
    columnHelper.accessor("type", { header: "Type" }),
    columnHelper.accessor("assigned", { header: "Assigned" }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => (
        <StatusChip tone={info.getValue().includes("Complete") ? "good" : info.getValue().includes("Audit") ? "purple" : info.getValue().includes("Pended") ? "warn" : "info"}>
          <IconForStatus status={info.getValue()} />
          {info.getValue()}
        </StatusChip>
      )
    }),
    columnHelper.accessor("queue", { header: "Queue" }),
    columnHelper.accessor("lockedBy", {
      header: "Lock",
      cell: (info) =>
        info.getValue() ? (
          <StatusChip tone="warn">
            <Lock size={14} />
            {info.getValue()}
          </StatusChip>
        ) : (
          <StatusChip>Unlocked</StatusChip>
        )
    }),
    columnHelper.display({
      id: "categories",
      header: "Indicators",
      cell: (info) => (
        <div className="category-strip" aria-label="Category indicators">
          {Object.entries(info.row.original.categories).map(([category, value]) => (
            <QueueCategoryBadge key={category} category={category as keyof typeof categoryTokens} count={value.count} />
          ))}
          <StatusChip tone="purple">R {info.row.original.recapture}</StatusChip>
          <StatusChip tone="warn">S {info.row.original.suspect}</StatusChip>
        </div>
      )
    }),
    columnHelper.display({
      id: "actions",
      header: "Action",
      cell: (info) => (
        <div className="row-actions">
          <Button variant="primary" onClick={() => open(info.row.original.review.id)}>
            Open
          </Button>
          {canTakeCoverage(data, info.row.original.review, currentUser) && !isAssignedToUser(info.row.original.review, currentUser) ? (
            <Button variant="secondary" onClick={() => actions.takeCoverage(info.row.original.review.id)}>
              <UserPlus size={14} />
              Cover
            </Button>
          ) : null}
        </div>
      )
    })
  ];

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const sortedRows = table.getRowModel().rows.map((row) => row.original);

  return (
    <div className="page-stack">
      <Panel
        title="Work Queue"
        actions={
          <Button variant="primary" onClick={nextPatient}>
            <Play size={16} />
            Next Patient Chart
          </Button>
        }
      >
        <div className="filter-bar">
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, clinic, payer, provider, assigned user" />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Workflow status">
            <option>All</option>
            {Array.from(new Set(data.reviews.map((review) => review.status))).map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select value={reviewTypeFilter} onChange={(event) => setReviewTypeFilter(event.target.value)} aria-label="Review type">
            <option>All</option>
            <option>Retrospective</option>
            <option>Concurrent</option>
            <option>Prospective</option>
          </select>
          <select value={teamMemberFilter} onChange={(event) => setTeamMemberFilter(event.target.value)} aria-label="Team member">
            <option value="All">All team members</option>
            {data.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Category">
            <option value="All">All categories</option>
            <option value="validated">Validated</option>
            <option value="potentialDelete">Potential Delete</option>
            <option value="potentialAddition">Potential Addition</option>
            <option value="prospective">CDI Recapture/Suspect</option>
          </select>
          <select value={sourceExampleFilter} onChange={(event) => setSourceExampleFilter(event.target.value)} aria-label="Scenario or source example">
            <option value="All">All source/scenario examples</option>
            {sourceExampleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <label className="checkbox-filter">
            <input type="checkbox" checked={noVisitOnly} onChange={(event) => setNoVisitOnly(event.target.checked)} />
            No upcoming visit
          </label>
          <Button variant="ghost" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
        <div className="queue-count">{filteredRows.length} result(s)</div>
        <div className="table-wrap queue-table-wrap" aria-label="Desktop work queue">
          <table className="data-table queue-table">
            <colgroup>
              <col className="queue-col-patient" />
              <col className="queue-col-payer" />
              <col className="queue-col-clinic" />
              <col className="queue-col-provider" />
              <col className="queue-col-year" />
              <col className="queue-col-type" />
              <col className="queue-col-assigned" />
              <col className="queue-col-status" />
              <col className="queue-col-queue" />
              <col className="queue-col-lock" />
              <col className="queue-col-indicators" />
              <col className="queue-col-actions" />
            </colgroup>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>
                      <button type="button" onClick={header.column.getToggleSortingHandler()} className="table-sort">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown size={13} />
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-queue-list" aria-label="Mobile work queue cards">
          {sortedRows.map((row) => (
            <MobileQueueCard key={row.review.id} row={row} data={data} currentUser={currentUser} onOpen={open} onCover={actions.takeCoverage} />
          ))}
        </div>
      </Panel>
      <Panel title="Personal Statistics">
        <div className="stat-grid">
          <Stat label="Assigned Reviews" value={personalStats.assignedReviews} />
          <Stat label="Completed" value={personalStats.completedReviews} />
          <Stat label="Pended" value={personalStats.pendedReviews} />
          <Stat label="Validations" value={personalStats.validations} />
          <Stat label="Deletions" value={personalStats.deletions} />
          <Stat label="Additions" value={personalStats.additions} />
          <Stat label="Prospective Decisions" value={personalStats.prospectiveDecisions} />
          <Stat label="Recapture Decisions" value={personalStats.recaptureDecisions} />
          <Stat label="Suspect Decisions" value={personalStats.suspectDecisions} />
          <Stat label="Recommendation Agreement" value={personalStats.recommendationAgreement} suffix="%" />
          <Stat label="Audit Agreement" value={personalStats.auditAgreement} suffix="%" />
        </div>
      </Panel>
    </div>
  );
}

function MobileQueueCard({
  row,
  data,
  currentUser,
  onOpen,
  onCover
}: {
  row: QueueRow;
  data: ReturnType<typeof useAppState>["data"];
  currentUser: ReturnType<typeof useAppState>["currentUser"];
  onOpen: (reviewId: string) => void;
  onCover: (reviewId: string) => void;
}) {
  const canCover = canTakeCoverage(data, row.review, currentUser) && !isAssignedToUser(row.review, currentUser);
  return (
    <article className="queue-card">
      <header>
        <div className="patient-cell">
          <strong>{row.patient}</strong>
          <span>
            {row.dob} - {row.memberId}
          </span>
        </div>
        <StatusChip tone={row.status.includes("Complete") ? "good" : row.status.includes("Audit") ? "purple" : row.status.includes("Pended") ? "warn" : "info"}>
          <IconForStatus status={row.status} />
          {row.status}
        </StatusChip>
      </header>
      <dl className="queue-card-details">
        <div>
          <dt>Payer</dt>
          <dd>{row.payer}</dd>
        </div>
        <div>
          <dt>Clinic</dt>
          <dd>{row.clinic}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{row.provider}</dd>
        </div>
        <div>
          <dt>CY / type</dt>
          <dd>
            {row.year} - {row.type}
          </dd>
        </div>
        <div>
          <dt>Assigned</dt>
          <dd>{row.assigned}</dd>
        </div>
        <div>
          <dt>Queue</dt>
          <dd>{row.queue}</dd>
        </div>
        <div>
          <dt>Lock</dt>
          <dd>{row.lockedBy ? `Locked by ${row.lockedBy}` : "Unlocked"}</dd>
        </div>
      </dl>
      <div className="category-strip queue-card-indicators" aria-label="Category indicators">
        {Object.entries(row.categories).map(([category, value]) => (
          <QueueCategoryBadge key={category} category={category as keyof typeof categoryTokens} count={value.count} />
        ))}
        <StatusChip tone="purple">Recapture {row.recapture}</StatusChip>
        <StatusChip tone="warn">Suspect {row.suspect}</StatusChip>
      </div>
      {row.sourceExamples.length ? <ScenarioTagList tags={row.sourceExamples} limit={6} /> : null}
      <div className="row-actions queue-card-actions">
        <Button variant="primary" onClick={() => onOpen(row.review.id)}>
          Open
        </Button>
        {canCover ? (
          <Button variant="secondary" onClick={() => onCover(row.review.id)}>
            <UserPlus size={14} />
            Cover
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function ScenarioTagList({ tags, limit }: { tags: string[]; limit?: number }) {
  const visibleTags = typeof limit === "number" ? tags.slice(0, limit) : tags;
  const remaining = typeof limit === "number" ? tags.length - visibleTags.length : 0;
  return (
    <div className="scenario-tags" aria-label="Source and scenario examples">
      {visibleTags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
      {remaining > 0 ? <span>+{remaining}</span> : null}
    </div>
  );
}

function Stat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>
        {value}
        {suffix}
      </strong>
    </div>
  );
}

function QueueCategoryBadge({ category, count }: { category: keyof typeof categoryTokens; count: number }) {
  const token = categoryTokens[category];
  const label =
    category === "potentialDelete" ? "Delete" : category === "potentialAddition" ? "Addition" : category === "prospective" ? "CDI" : token.label;
  return (
    <span className="category-badge queue-category-badge" style={{ color: token.color, background: token.bg, borderColor: token.border }}>
      <span className="dot" />
      {label}
      <strong>{count}</strong>
    </span>
  );
}
