export function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatRaf(value: number) {
  return value.toFixed(3);
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}
