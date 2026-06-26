import { LeadStatus, LeadSource } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<LeadStatus, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-blue-100 text-blue-700 border-blue-200" },
  CONTACTED: {
    label: "Contacted",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  INTERESTED: {
    label: "Interested",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  VISIT_SCHEDULED: {
    label: "Visit scheduled",
    className: "bg-violet-100 text-violet-700 border-violet-200",
  },
  NEGOTIATING: {
    label: "Negotiating",
    className: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  CLOSED: {
    label: "Closed",
    className: "bg-green-600 text-white border-green-600",
  },
  LOST: { label: "Lost", className: "bg-red-100 text-red-700 border-red-200" },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

const SOURCE_STYLES: Record<LeadSource, { label: string; className: string }> = {
  NINETYNINEACRES: {
    label: "99acres",
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
  MAGICBRICKS: {
    label: "MagicBricks",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  HOUSING: {
    label: "Housing.com",
    className: "bg-cyan-100 text-cyan-700 border-cyan-200",
  },
  MANUAL: {
    label: "Manual",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

export function LeadSourceBadge({ source }: { source: LeadSource }) {
  const style = SOURCE_STYLES[source];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

export const LEAD_STATUS_OPTIONS = Object.entries(STATUS_STYLES).map(
  ([value, { label }]) => ({ value: value as LeadStatus, label }),
);

export const LEAD_SOURCE_OPTIONS = Object.entries(SOURCE_STYLES).map(
  ([value, { label }]) => ({ value: value as LeadSource, label }),
);
