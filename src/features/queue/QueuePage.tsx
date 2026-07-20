import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown, Info, Lock, Play, Search, UserPlus } from "lucide-react";
import { useAppState } from "../../state/AppState";
import {
  byId,
  getPresentedOpportunitySummary,
  getProspectiveCounts,
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
  const [visitFilter, setVisitFilter] = useState("All");
  const [nextPatientMessage, setNextPatientMessage] = useState("");
  const canFilterByTeamMember = canAssignReviews(currentUser) || canUseCdiCoverageFilter;

  useEffect(() => {
    setTeamMemberFilter(canUseCdiCoverageFilter ? "Mine" : "All");
    setNextPatientMessage("");
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
        noVisit: !maps.appointments.has(patient.id),
        age: calculateAge(patient.dob, appointment?.date),
        totalRaf
      };
    });
  }, [currentUser, data, maps]);

  const teamMemberOptions = useMemo(
    () =>
      data.users
        .filter((user) => user.roles.includes("CDI/Coder"))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.users]
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
    const matchesVisit = visitFilter === "All" || (visitFilter === "Upcoming" ? !row.noVisit : row.noVisit);
    return matchesSearch && matchesStatus && matchesType && matchesMember && matchesCategory && matchesVisit;
  }), [canFilterByTeamMember, categoryFilter, currentUser, query, reviewTypeFilter, rows, statusFilter, teamMemberFilter, visitFilter]);

  function clearFilters() {
    setQuery("");
    setStatusFilter("All");
    setReviewTypeFilter("All");
    if (canFilterByTeamMember) setTeamMemberFilter(canUseCdiCoverageFilter ? "Mine" : "All");
    setCategoryFilter("All");
    setVisitFilter("All");
    setNextPatientMessage("");
  }

  function open(reviewId: string) {
    actions.openReview(reviewId);
    navigate(`/review/${reviewId}`);
  }

  function nextPatient() {
    const next = filteredRows.find((row) => canOpenReview(data, row.review, currentUser) && !row.review.lock && ["Available", "Pended"].includes(row.review.status));
    if (next) {
      setNextPatientMessage("");
      open(next.review.id);
      return;
    }
    setNextPatientMessage(
      filteredRows.length === 0
        ? "No charts match the current filters. Clear or adjust the filters to continue."
        : "No eligible next chart is available. The visible charts are locked, completed, or unavailable for your role."
    );
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
        {nextPatientMessage ? (
          <div className="warning-banner queue-action-feedback" role="status" aria-live="polite">
            <Info size={17} aria-hidden="true" />
            {nextPatientMessage}
          </div>
        ) : null}
        <div className="filter-bar">
          <label className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setNextPatientMessage("");
              }}
              placeholder="Search patients, member ID, payer, or provider"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setNextPatientMessage("");
            }}
            aria-label="Workflow status"
          >
            <option value="All">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select
            value={reviewTypeFilter}
            onChange={(event) => {
              setReviewTypeFilter(event.target.value);
              setNextPatientMessage("");
            }}
            aria-label="Review type"
          >
            <option value="All">All review types</option>
            <option>Retrospective</option>
            <option>Concurrent</option>
            <option>Prospective</option>
          </select>
          {canAssignReviews(currentUser) ? (
            <select
              value={teamMemberFilter}
              onChange={(event) => {
                setTeamMemberFilter(event.target.value);
                setNextPatientMessage("");
              }}
              aria-label="Team member"
            >
              <option value="All">All team members</option>
              {teamMemberOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setNextPatientMessage("");
            }}
            aria-label="Category"
          >
            <option value="All">All categories</option>
            <option value="validated">Validated</option>
            <option value="potentialDelete">Potential Delete</option>
            <option value="potentialAddition">Potential Addition</option>
            <option value="prospective">CDI Recapture/Suspect</option>
          </select>
          <select
            value={visitFilter}
            onChange={(event) => {
              setVisitFilter(event.target.value);
              setNextPatientMessage("");
            }}
            aria-label="Visit timing"
          >
            <option value="All">All visits</option>
            <option value="Upcoming">Upcoming visits</option>
            <option value="No upcoming visit">No upcoming visit</option>
          </select>
          <Button variant="ghost" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
        <div className="queue-list-meta">
          <CategoryLegend />
          <div className="queue-count">{filteredRows.length} chart(s)</div>
        </div>
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
      </Panel>
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

function QueueCategoryBadge({ category, count, compact = false }: { category: keyof typeof categoryTokens; count: number; compact?: boolean }) {
  const token = categoryTokens[category];
  const label =
    category === "potentialDelete" ? "Delete" : category === "potentialAddition" ? "Addition" : category === "prospective" ? "CDI" : token.label;
  return (
    <span
      className={`category-badge queue-category-badge${compact ? " compact" : ""}`}
      style={{ color: token.color, background: token.bg, borderColor: token.border }}
      aria-label={`${token.label}: ${count}`}
      title={`${token.label}: ${count}`}
    >
      {compact ? null : <span className="dot" />}
      {compact ? null : label}
      <strong>{count}</strong>
    </span>
  );
}
