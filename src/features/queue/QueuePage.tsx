import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, Lock, Play, Search, UserPlus } from "lucide-react";
import { useAppState } from "../../state/AppState";
import {
  byId,
  getPresentedOpportunitySummary,
  getProspectiveCounts,
  getReviewScenarioTags,
  isAssignedToUser
} from "../../domain/selectors";
import type { PatientReview, WorkflowStatus } from "../../domain/types";
import { formatDate } from "../../domain/format";
import { Button, IconForStatus, Panel, StatusChip } from "../../ui/Primitives";
import { categoryTokens } from "../../domain/tokens";
import { canAssignReviews, canOpenReview, canTakeCoverage, getVisibleReviews, hasAnyRole } from "../../domain/auth";

interface QueueRow {
  review: PatientReview;
  patient: string;
  dob: string;
  memberId: string;
  payer: string;
  clinic: string;
  provider: string;
  appointmentDate: string;
  appointmentType: string;
  year: number;
  type: string;
  assigned: string;
  originalAssignee: string;
  coverageBy: string;
  status: WorkflowStatus;
  queue: string;
  lockedBy: string;
  categories: ReturnType<typeof getPresentedOpportunitySummary>;
  recapture: number;
  suspect: number;
  sourceExamples: string[];
  noVisit: boolean;
  age: number;
  totalRaf: number;
}

const columnHelper = createColumnHelper<QueueRow>();

export function QueuePage() {
  const { data, currentUser, actions } = useAppState();
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([{ id: "status", desc: false }]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [reviewTypeFilter, setReviewTypeFilter] = useState("All");
  const canUseCdiCoverageFilter = currentUser.roles.includes("CDI/Coder") && !hasAnyRole(currentUser, ["Administrator", "Manager", "Auditor"]);
  const [teamMemberFilter, setTeamMemberFilter] = useState(canUseCdiCoverageFilter ? "Mine" : "All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceExampleFilter, setSourceExampleFilter] = useState("All");
  const [noVisitOnly, setNoVisitOnly] = useState(false);
  const canFilterByTeamMember = canAssignReviews(currentUser) || canUseCdiCoverageFilter;

  useEffect(() => {
    setTeamMemberFilter(canUseCdiCoverageFilter ? "Mine" : "All");
  }, [canUseCdiCoverageFilter, currentUser.id]);

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
      const assignedUsers = [review.assignedUserId, review.assignedAuditorId]
        .map((id) => (id ? maps.users.get(id)?.name : undefined))
        .filter(Boolean)
        .join(" / ");
      const coverageBy = review.coverage ? maps.users.get(review.coverage.coveringUserId)?.name ?? "Unknown CDI/Coder" : "";
      const categories = getPresentedOpportunitySummary(data, review);
      const counts = getProspectiveCounts(data, review);
      const appointment = data.appointments.find((item) => item.id === review.appointmentId || item.patientId === patient.id);
      const totalRaf = categories.validated.raf + categories.potentialAddition.raf + categories.prospective.raf - categories.potentialDelete.raf;
      return {
        review,
        patient: patient.name,
        dob: formatDate(patient.dob),
        memberId: patient.memberId,
        payer: maps.payers.get(patient.payerId)?.name ?? "-",
        clinic: maps.clinics.get(review.clinicId)?.name ?? "-",
        provider: maps.providers.get(review.providerId)?.name ?? "-",
        appointmentDate: appointment ? formatDate(appointment.date) : "No upcoming visit",
        appointmentType: appointment?.type ?? "Outreach list",
        year: review.calendarYear,
        type: review.reviewType,
        assigned: coverageBy ? `${assignedUsers || "Unassigned"} / Coverage: ${coverageBy}` : assignedUsers || "Unassigned",
        originalAssignee: maps.users.get(review.assignedUserId)?.name ?? "Unassigned",
        coverageBy,
        status: review.status,
        queue: review.queue,
        lockedBy: review.lock ? maps.users.get(review.lock.lockedByUserId)?.name ?? "Unknown user" : "",
        categories,
        recapture: counts.recapture,
        suspect: counts.suspect,
        sourceExamples: getReviewScenarioTags(data, review),
        noVisit: !maps.appointments.has(patient.id),
        age: calculateAge(patient.dob, appointment?.date),
        totalRaf
      };
    });
  }, [currentUser, data, maps]);

  const sourceExampleOptions = useMemo(() => Array.from(new Set(rows.flatMap((row) => row.sourceExamples))).sort((a, b) => a.localeCompare(b)), [rows]);
  const teamMemberOptions = useMemo(
    () =>
      data.users
        .filter((user) => user.roles.includes("CDI/Coder"))
        .filter((user) => !canUseCdiCoverageFilter || user.teamId === currentUser.teamId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [canUseCdiCoverageFilter, currentUser.teamId, data.users]
  );
  const selectableTeamMemberOptions = useMemo(
    () => teamMemberOptions.filter((user) => !(canUseCdiCoverageFilter && user.id === currentUser.id)),
    [canUseCdiCoverageFilter, currentUser.id, teamMemberOptions]
  );
  const statusOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.status))), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const search = query.trim().toLowerCase();
    const matchesSearch =
      !search ||
      [row.patient, row.memberId, row.payer, row.clinic, row.provider, row.assigned, row.queue].some((field) => field.toLowerCase().includes(search));
    const matchesStatus = statusFilter === "All" || row.status === statusFilter;
    const matchesType = reviewTypeFilter === "All" || row.type === reviewTypeFilter;
    const matchesMember =
      !canFilterByTeamMember ||
      teamMemberFilter === "All" ||
      (teamMemberFilter === "Mine" ? isAssignedToUser(row.review, currentUser) : row.review.assignedUserId === teamMemberFilter);
    const matchesCategory = categoryFilter === "All" || row.categories[categoryFilter as keyof typeof row.categories]?.count > 0;
    const matchesSourceExample = sourceExampleFilter === "All" || row.sourceExamples.includes(sourceExampleFilter);
    const matchesVisit = !noVisitOnly || row.noVisit;
    return matchesSearch && matchesStatus && matchesType && matchesMember && matchesCategory && matchesSourceExample && matchesVisit;
  }), [canFilterByTeamMember, categoryFilter, currentUser, noVisitOnly, query, reviewTypeFilter, rows, sourceExampleFilter, statusFilter, teamMemberFilter]);

  function clearFilters() {
    setQuery("");
    setStatusFilter("All");
    setReviewTypeFilter("All");
    if (canFilterByTeamMember) setTeamMemberFilter(canUseCdiCoverageFilter ? "Mine" : "All");
    setCategoryFilter("All");
    setSourceExampleFilter("All");
    setNoVisitOnly(false);
  }

  function open(reviewId: string) {
    actions.openReview(reviewId);
    navigate(`/review/${reviewId}`);
  }

  function nextPatient() {
    const next = filteredRows.find((row) => canOpenReview(data, row.review, currentUser) && !row.review.lock && ["Available", "Pended"].includes(row.review.status));
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
    columnHelper.accessor("originalAssignee", { header: "Original CDI/Coder" }),
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
      header: "Editing",
      cell: (info) =>
        info.getValue() ? (
          <StatusChip tone="warn">
            <Lock size={14} />
            {info.getValue()}
          </StatusChip>
        ) : (
          <StatusChip>No active editor</StatusChip>
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
            {canOpenReview(data, info.row.original.review, currentUser) ? "Open" : "View"}
          </Button>
          {canTakeCoverage(data, info.row.original.review, currentUser) && !isAssignedToUser(info.row.original.review, currentUser) ? (
            <Button variant="secondary" onClick={() => actions.takeCoverage(info.row.original.review.id)}>
              <UserPlus size={14} />
              Take Coverage
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
  const priorityRows = sortedRows.filter((row) => !row.noVisit);
  const lowPriorityRows = sortedRows.filter((row) => row.noVisit);
  const completedCount = rows.filter((row) => row.status === "Completed" || row.status === "Audit Complete").length;
  const assignedCount = rows.length;
  const averageRaf = rows.length
    ? rows.reduce((sum, row) => sum + row.categories.validated.raf + row.categories.potentialAddition.raf + row.categories.prospective.raf - row.categories.potentialDelete.raf, 0) / rows.length
    : 0;
  const agreementCount = data.conditions.filter((condition) => condition.disposition?.agreedWithRecommendation).length;
  const decisionCount = data.conditions.filter((condition) => condition.disposition).length;

  return (
    <div className={`page-stack ${canAssignReviews(currentUser) ? "manager-queue-page" : "cdi-queue-page"}`}>
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
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select value={reviewTypeFilter} onChange={(event) => setReviewTypeFilter(event.target.value)} aria-label="Review type">
            <option>All</option>
            <option>Retrospective</option>
            <option>Concurrent</option>
            <option>Prospective</option>
          </select>
          {canFilterByTeamMember ? (
            <select value={teamMemberFilter} onChange={(event) => setTeamMemberFilter(event.target.value)} aria-label="Team member">
              {canUseCdiCoverageFilter ? <option value="Mine">My Queue</option> : null}
              <option value="All">{canUseCdiCoverageFilter ? "All CDI/Coder Queues" : "All team members"}</option>
              {selectableTeamMemberOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          ) : null}
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
        <div className="queue-metric-grid">
          <QueueMetric label="Charts assigned" value={assignedCount} />
          <QueueMetric label="Charts completed" value={completedCount} />
          <QueueMetric label="Average RAF impact" value={averageRaf.toFixed(3)} />
          <QueueMetric label="AI agreement" value={`${Math.round((agreementCount / Math.max(1, decisionCount)) * 100)}%`} />
        </div>
        <CategoryLegend />
        <PatientQueueSection title="Upcoming Visits" rows={priorityRows} data={data} currentUser={currentUser} onOpen={open} onCover={actions.takeCoverage} />
        <PatientQueueSection title="Low Priority - No Upcoming Visit" rows={lowPriorityRows} data={data} currentUser={currentUser} onOpen={open} onCover={actions.takeCoverage} lowPriority />
        <div className="table-wrap queue-table-wrap legacy-queue-table" aria-label="Detailed desktop work queue">
          <table className="data-table queue-table">
            <colgroup>
              <col className="queue-col-patient" />
              <col className="queue-col-payer" />
              <col className="queue-col-clinic" />
              <col className="queue-col-provider" />
              <col className="queue-col-year" />
              <col className="queue-col-type" />
              <col className="queue-col-assigned" />
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
          <dt>Original CDI/Coder</dt>
          <dd>{row.originalAssignee}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{row.coverageBy || "None"}</dd>
        </div>
        <div>
          <dt>Queue</dt>
          <dd>{row.queue}</dd>
        </div>
        <div>
          <dt>Editing</dt>
          <dd>{row.lockedBy ? `Being edited by ${row.lockedBy}` : "No active editor"}</dd>
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
          {canOpenReview(data, row.review, currentUser) ? "Open" : "View"}
        </Button>
        {canCover ? (
          <Button variant="secondary" onClick={() => onCover(row.review.id)}>
            <UserPlus size={14} />
            Take Coverage
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function QueueMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="queue-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CategoryLegend() {
  return (
    <div className="queue-category-legend" aria-label="Category legend">
      <span><i className="legend-dot legend-validated" />Validated</span>
      <span><i className="legend-dot legend-delete" />Potential Delete</span>
      <span><i className="legend-dot legend-addition" />Potential Addition</span>
      <span><i className="legend-dot legend-prospective" />CDI Recapture / Suspect</span>
    </div>
  );
}

function PatientQueueSection({
  title,
  rows,
  data,
  currentUser,
  onOpen,
  onCover,
  lowPriority = false
}: {
  title: string;
  rows: QueueRow[];
  data: ReturnType<typeof useAppState>["data"];
  currentUser: ReturnType<typeof useAppState>["currentUser"];
  onOpen: (reviewId: string) => void;
  onCover: (reviewId: string) => void;
  lowPriority?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <section className="patient-queue-section">
      <div className="patient-queue-heading">
        <h3>{title}</h3>
        <StatusChip tone={lowPriority ? "warn" : "good"}>{rows.length} chart(s)</StatusChip>
      </div>
      <div className="patient-queue-table-head" aria-hidden="true">
        <span>Patient</span>
        <span>DOS - Provider</span>
        <span>Payer</span>
        <span>Total RAF</span>
        <span>Categories</span>
        <span>Action</span>
      </div>
      <div className="patient-queue-list">
        {rows.map((row) => (
          <article key={row.review.id} className={`patient-queue-row ${lowPriority ? "low-priority" : ""}`}>
            <div className="patient-queue-patient">
              <button type="button" onClick={() => onOpen(row.review.id)}>
                <strong>{row.patient}</strong>
                <span>
                  {row.memberId} - DOB {row.dob} - Age {row.age}
                </span>
              </button>
              {row.sourceExamples.length ? <ScenarioTagList tags={row.sourceExamples} limit={2} /> : null}
              <div className="patient-queue-status">
                {lowPriority ? <StatusChip tone="warn">Low priority - no upcoming visit</StatusChip> : <StatusChip tone="good">Upcoming visit</StatusChip>}
                <StatusChip>{row.status}</StatusChip>
              </div>
            </div>
            <div className="patient-queue-dos">
              <strong>{row.appointmentDate}</strong>
              <span>{row.provider}</span>
              <small>{row.appointmentType}</small>
            </div>
            <div className="patient-queue-payer">{row.payer}</div>
            <div className="patient-queue-raf">{row.totalRaf.toFixed(3)}</div>
            <div className="patient-queue-categories" aria-label="Category indicators">
              {Object.entries(row.categories).map(([category, value]) => (
                <QueueCategoryBadge key={category} category={category as keyof typeof categoryTokens} count={value.count} compact />
              ))}
            </div>
            <div className="row-actions">
              <Button variant="primary" onClick={() => onOpen(row.review.id)}>
                {canOpenReview(data, row.review, currentUser) ? "Open" : "View"}
              </Button>
              {canTakeCoverage(data, row.review, currentUser) && !isAssignedToUser(row.review, currentUser) ? (
                <Button variant="secondary" onClick={() => onCover(row.review.id)}>
                  <UserPlus size={14} />
                  Take Coverage
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function calculateAge(dob: string, asOfDate?: string) {
  const birthDate = new Date(`${dob}T00:00:00`);
  const today = new Date(`${asOfDate ?? new Date().toISOString().slice(0, 10)}T00:00:00`);
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthday = today.getMonth() > birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthday) age -= 1;
  return age;
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

function QueueCategoryBadge({ category, count, compact = false }: { category: keyof typeof categoryTokens; count: number; compact?: boolean }) {
  const token = categoryTokens[category];
  const label =
    category === "potentialDelete" ? "Delete" : category === "potentialAddition" ? "Addition" : category === "prospective" ? "CDI" : token.label;
  return (
    <span className={`category-badge queue-category-badge${compact ? " compact" : ""}`} style={{ color: token.color, background: token.bg, borderColor: token.border }}>
      {compact ? null : <span className="dot" />}
      {compact ? null : label}
      <strong>{count}</strong>
    </span>
  );
}
