"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import {
  SourceBadge,
  type AttendanceRecordRow,
  type DeviceRow,
  type UnmappedRow,
} from "../../../components/attendance";
import { ValidityBadge } from "../../../components/memberships";

type Tab = "daily" | "manual" | "unmapped" | "devices";

export default function AttendancePage() {
  const { has } = useAuth();
  const [tab, setTab] = useState<Tab>("daily");
  const canWrite = has("attendance.correct");
  const canManageDevices = has("settings.manage");

  const tabs: { key: Tab; label: string }[] = [
    { key: "daily", label: "Daily" },
    ...(canWrite ? [{ key: "manual" as Tab, label: "Manual check-in" }] : []),
    { key: "unmapped", label: "Unmapped" },
    { key: "devices", label: "Devices" },
  ];
  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Attendance</h1>
        <p className="page-sub">
          Check-in only · one record per member per day · raw scans preserved.
        </p>
      </div>
      <div className="flex gap-1 border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active === "daily" && <DailyTab />}
      {active === "manual" && canWrite && <ManualTab />}
      {active === "unmapped" && <UnmappedTab canMap={canWrite} />}
      {active === "devices" && <DevicesTab canManage={canManageDevices} />}
    </div>
  );
}

/* ---------------- daily ---------------- */

/* ---------------- daily roster ---------------- */

interface RosterMember {
  id: string;
  memberCode: string;
  fullName: string;
  status: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function DailyTab() {
  const queryClient = useQueryClient();
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  // memberId -> edited "HH:MM" (undefined = untouched)
  const [edits, setEdits] = useState<Record<string, string | undefined>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(0);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ["roster-members", q, page, limit],
    queryFn: () =>
      apiFetch<{ data: RosterMember[]; meta: { total: number } }>(
        `/members?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`,
      ),
  });
  const records = useQuery({
    queryKey: ["roster-records", date],
    queryFn: () =>
      apiFetch<{ data: (AttendanceRecordRow & { validity?: string })[] }>(
        `/attendance/daily?date=${date}&includeValidity=true&limit=500`,
      ),
  });

  const byMember = useMemo(() => {
    const map = new Map<string, AttendanceRecordRow & { validity?: string }>();
    for (const r of records.data?.data ?? []) map.set(r.member.id, r);
    return map;
  }, [records.data]);

  const rows = useMemo(
    () => (members.data?.data ?? []).filter((m) => m.status !== "archived"),
    [members.data],
  );
  const total = members.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  const timeOf = (memberId: string): string => {
    if (edits[memberId] !== undefined) return edits[memberId] as string;
    const rec = byMember.get(memberId);
    return rec ? rec.checkInAt.slice(11, 16) : "";
  };
  const isDirty = (memberId: string): boolean => {
    if (edits[memberId] === undefined) return false;
    const rec = byMember.get(memberId);
    return (edits[memberId] as string) !== (rec ? rec.checkInAt.slice(11, 16) : "");
  };
  const dirtyIds = rows.map((m) => m.id).filter(isDirty);
  const present = byMember.size;
  const manualCount = [...byMember.values()].filter((r) => r.source === "manual").length;

  function shiftDay(delta: number) {
    const d = new Date(date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    const next = d.toISOString().slice(0, 10);
    if (next > todayStr()) return;
    setDate(next);
    setEdits({});
    setRowErrors({});
  }

  async function saveAll() {
    setRowErrors({});
    setSavedFlash(null);
    setSaving(1);
    let done = 0;
    const errors: Record<string, string> = {};
    for (const memberId of dirtyIds) {
      const rec = byMember.get(memberId);
      const value = (edits[memberId] as string) ?? "";
      try {
        if (!rec && value) {
          await apiFetch("/attendance/manual", {
            method: "POST",
            body: JSON.stringify({ memberId, date, time: value }),
          });
        } else if (rec && value && value !== rec.checkInAt.slice(11, 16)) {
          await apiFetch(`/attendance/records/${rec.id}`, {
            method: "PATCH",
            body: JSON.stringify({ checkInTime: value, reason: "Daily roster edit" }),
          });
        }
        // Clearing an existing record is not allowed — records are never deleted.
        setEdits((e) => {
          const next = { ...e };
          delete next[memberId];
          return next;
        });
        done++;
        setSaving(done + 1);
      } catch (e) {
        errors[memberId] = e instanceof ApiError ? e.message : "Save failed";
      }
    }
    setRowErrors(errors);
    setSaving(0);
    await queryClient.invalidateQueries({ queryKey: ["roster-records"] });
    const failed = Object.keys(errors).length;
    setSavedFlash(
      failed === 0
        ? `Saved ${done} change${done === 1 ? "" : "s"}.`
        : `Saved ${done}, ${failed} failed — see rows.`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2">
        <button
          className="btn-ghost px-2.5 py-1.5"
          onClick={() => shiftDay(-1)}
          aria-label="Previous day"
        >
          ‹
        </button>
        <input
          className="input w-40"
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => {
            if (e.target.value && e.target.value <= todayStr()) {
              setDate(e.target.value);
              setEdits({});
              setRowErrors({});
            }
          }}
        />
        <button
          className="btn-ghost px-2.5 py-1.5 text-xs"
          disabled={date === todayStr()}
          onClick={() => {
            setDate(todayStr());
            setEdits({});
            setRowErrors({});
          }}
        >
          Today
        </button>
        <button
          className="btn-ghost px-2.5 py-1.5"
          onClick={() => shiftDay(1)}
          disabled={date >= todayStr()}
          aria-label="Next day"
        >
          ›
        </button>
        <button
          className="btn-ghost px-2.5 py-1.5"
          aria-label="Refresh"
          onClick={() => {
            members.refetch();
            records.refetch();
          }}
        >
          ↻
        </button>
        <span className="ml-auto flex items-center gap-2">
          <span className="badge">{present} present</span>
          {dirtyIds.length > 0 && <span className="badge-orange">{dirtyIds.length} unsaved</span>}
          <button
            className="btn-primary text-sm"
            disabled={dirtyIds.length === 0 || saving > 0}
            onClick={saveAll}
          >
            {saving > 0 ? `Saving ${saving}/${dirtyIds.length + 1}…` : "Save Changes"}
          </button>
        </span>
      </div>

      {savedFlash && <p className="alert-ok">{savedFlash}</p>}

      <div className="card flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search member name, code or mobile"
        />
        <p className="ml-auto text-xs text-stone-500">
          Device {present - manualCount} · Manual {manualCount} · clearing a time is not allowed
          (records are never deleted)
        </p>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Validity</th>
              <th>Check-in</th>
              <th>Source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const rec = byMember.get(m.id);
              const value = timeOf(m.id);
              const dirty = isDirty(m.id);
              const err = rowErrors[m.id];
              return (
                <tr key={m.id}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700"
                      >
                        {initials(m.fullName)}
                      </span>
                      <span>
                        <Link
                          href={`/members/${m.id}`}
                          className="font-medium text-stone-900 hover:text-brand-700"
                        >
                          {m.fullName}
                        </Link>
                        <span className="block text-xs text-stone-500">{m.memberCode}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    {rec?.validity ? (
                      <ValidityBadge validity={rec.validity} />
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                  <td>
                    <input
                      className={`input w-28 tabular-nums ${dirty ? "border-brand-400 ring-2 ring-brand-500/20" : ""}`}
                      type="time"
                      value={value}
                      onChange={(e) => setEdits((ed) => ({ ...ed, [m.id]: e.target.value }))}
                      onBlur={(e) => {
                        // Reverting an emptied existing record: blanks are not saved.
                        if (!e.target.value && rec) {
                          setEdits((ed) => {
                            const next = { ...ed };
                            delete next[m.id];
                            return next;
                          });
                        }
                      }}
                    />
                  </td>
                  <td>
                    {rec ? (
                      <SourceBadge source={rec.source} />
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                  <td>
                    {err ? (
                      <span className="text-xs font-medium text-red-600">{err}</span>
                    ) : dirty ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Unsaved
                      </span>
                    ) : rec ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Saved
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {members.isLoading && <p className="p-4 text-sm text-stone-500">Loading roster…</p>}
        <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 bg-stone-50 px-4 py-2.5 text-sm">
          <span className="text-stone-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} members
          </span>
          <span className="ml-auto flex items-center gap-2">
            <label className="text-xs text-stone-500">Rows per page</label>
            <select
              className="input w-20 py-1 text-sm"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </span>
          <span className="text-xs text-stone-500">
            Page {page} of {pages}
          </span>
          <button
            className="btn-ghost px-2 py-1 text-xs"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ‹‹
          </button>
          <button
            className="btn-ghost px-2 py-1 text-xs"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ‹
          </button>
          <button
            className="btn-ghost px-2 py-1 text-xs"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            ›
          </button>
          <button
            className="btn-ghost px-2 py-1 text-xs"
            disabled={page >= pages}
            onClick={() => setPage(pages)}
          >
            ››
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- manual ---------------- */

function ManualTab() {
  const queryClient = useQueryClient();
  const [memberId, setMemberId] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const found = useQuery({
    queryKey: ["att-pick", search],
    queryFn: () =>
      apiFetch<{ data: { id: string; memberCode: string; fullName: string }[] }>(
        `/members?q=${encodeURIComponent(search)}&limit=8`,
      ),
    enabled: search.trim().length >= 2 && !memberId,
  });
  const picked = useQuery({
    queryKey: ["att-pick-one", memberId],
    queryFn: () =>
      apiFetch<{ id: string; memberCode: string; fullName: string }>(`/members/${memberId}`),
    enabled: !!memberId,
  });

  const checkIn = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>("/attendance/manual", {
        method: "POST",
        body: JSON.stringify({ memberId, date, time: time || undefined }),
      }),
    onSuccess: () => {
      setMsg("Check-in recorded.");
      setMemberId("");
      setSearch("");
      queryClient.invalidateQueries({ queryKey: ["attendance-daily"] });
    },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : "Failed"),
  });

  return (
    <div className="card max-w-xl">
      <h2 className="text-base font-semibold">Manual check-in</h2>
      <p className="page-sub">Audited under your name · idempotent per member per day.</p>
      <div className="mt-4 space-y-3">
        {memberId && picked.data ? (
          <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="font-medium">
              {picked.data.fullName}{" "}
              <span className="text-xs text-stone-500">{picked.data.memberCode}</span>
            </p>
            <button
              className="btn-ghost ml-auto px-2.5 py-1 text-xs"
              onClick={() => {
                setMemberId("");
                setSearch("");
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member…"
            />
            <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200">
              {found.data?.data.map((m) => (
                <li key={m.id}>
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-stone-50"
                    onClick={() => {
                      setMemberId(m.id);
                      setSearch("");
                    }}
                  >
                    <span className="font-medium">{m.fullName}</span>{" "}
                    <span className="text-xs text-stone-500">{m.memberCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Time (blank = now)</label>
            <input
              className="input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
        <button
          className="btn-primary"
          disabled={!memberId || checkIn.isPending}
          onClick={() => {
            setMsg(null);
            checkIn.mutate();
          }}
        >
          {checkIn.isPending ? "Recording…" : "Record check-in"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- unmapped ---------------- */

function UnmappedTab({ canMap }: { canMap: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [mappingFor, setMappingFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState("");

  const queue = useQuery({
    queryKey: ["unmapped", page],
    queryFn: () =>
      apiFetch<{ data: UnmappedRow[]; meta: { total: number } }>(
        `/attendance/unmapped?page=${page}`,
      ),
  });
  const found = useQuery({
    queryKey: ["unmapped-pick", search],
    queryFn: () =>
      apiFetch<{ data: { id: string; memberCode: string; fullName: string }[] }>(
        `/members?q=${encodeURIComponent(search)}&limit=8`,
      ),
    enabled: search.trim().length >= 2 && !!mappingFor,
  });

  const map = useMutation({
    mutationFn: () =>
      apiFetch(`/attendance/unmapped/${mappingFor}/map`, {
        method: "POST",
        body: JSON.stringify({ memberId: picked }),
      }),
    onSuccess: () => {
      setMappingFor(null);
      setPicked("");
      setSearch("");
      queryClient.invalidateQueries({ queryKey: ["unmapped"] });
    },
  });

  return (
    <div className="card">
      <h2 className="text-base font-semibold">Unmapped device users</h2>
      <p className="page-sub">
        Scans from fingerprints the system doesn't recognise yet. Nothing is discarded — mapping a
        user reprocesses their pending scans.
      </p>
      <ul className="mt-3 space-y-2">
        {queue.data?.data.map((e) => (
          <li key={e.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-medium">{e.deviceUserId}</span>
              <span className="text-xs text-stone-500">
                {e.device?.deviceCode} · {e.occurredAt.slice(0, 16).replace("T", " ")}
                {e.source === "simulated" ? " · simulated" : ""}
              </span>
              {canMap && (
                <button
                  className="btn-ghost ml-auto px-2.5 py-1 text-xs"
                  onClick={() => {
                    setMappingFor(mappingFor === e.id ? null : e.id);
                    setPicked("");
                    setSearch("");
                  }}
                >
                  {mappingFor === e.id ? "Cancel" : "Map to member…"}
                </button>
              )}
            </div>
            {mappingFor === e.id && (
              <div className="mt-2">
                <input
                  className="input"
                  value={search}
                  onChange={(ev) => setSearch(ev.target.value)}
                  placeholder="Search member…"
                />
                <ul className="mt-1 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
                  {found.data?.data.map((m) => (
                    <li key={m.id}>
                      <button
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-stone-50 ${picked === m.id ? "bg-orange-50 font-medium" : ""}`}
                        onClick={() => setPicked(m.id)}
                      >
                        {m.fullName} <span className="text-xs text-stone-500">{m.memberCode}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  className="btn-primary mt-2 text-sm"
                  disabled={!picked || map.isPending}
                  onClick={() => map.mutate()}
                >
                  Confirm mapping
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {queue.data?.data.length === 0 && (
        <p className="mt-2 text-sm text-stone-500">Queue clear — every scan is mapped.</p>
      )}
      <div className="mt-3 flex gap-2 text-sm">
        <button
          className="btn-ghost px-3 py-1 text-xs"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          ← Prev
        </button>
        <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setPage(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}

/* ---------------- devices ---------------- */

interface SyncRun {
  id: string;
  startedAt: string;
  fetched: number;
  ingested: number;
  duplicates: number;
  unmapped: number;
  error: string | null;
}

function DevicesTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ deviceCode: "", name: "", model: "" });
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: () => apiFetch<DeviceRow[]>("/devices"),
  });
  const health = useQuery({
    queryKey: ["device-health", selected],
    queryFn: () =>
      apiFetch<{
        device: DeviceRow;
        lastSyncRun: SyncRun | null;
        activeMappings: number;
        eventsToday: number;
        unmappedPending: number;
      }>(`/devices/${selected}/health`),
    enabled: !!selected,
  });
  const mappings = useQuery({
    queryKey: ["device-mappings", selected],
    queryFn: () =>
      apiFetch<
        {
          id: string;
          deviceUserId: string;
          member: { memberCode: string; fullName: string } | null;
        }[]
      >(`/devices/${selected}/mappings`),
    enabled: !!selected,
  });
  const runs = useQuery({
    queryKey: ["device-runs", selected],
    queryFn: () => apiFetch<SyncRun[]>(`/devices/${selected}/sync-runs`),
    enabled: !!selected,
  });

  const create = useMutation({
    mutationFn: () => apiFetch("/devices", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm({ deviceCode: "", name: "", model: "" });
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Create failed"),
  });
  const rotate = useMutation({
    mutationFn: () =>
      apiFetch<{ apiKey: string }>(`/devices/${selected}/rotate-key`, { method: "POST" }),
    onSuccess: (d) => setKeyMsg(`New connector key (copy now — shown once): ${d.apiKey}`),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Rotation failed"),
  });
  const simulate = useMutation({
    mutationFn: () =>
      apiFetch(`/devices/${selected}/simulate`, {
        method: "POST",
        body: JSON.stringify({ count: 5 }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-health"] });
      queryClient.invalidateQueries({ queryKey: ["device-runs"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Simulation failed"),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="card h-fit">
        <h2 className="text-base font-semibold">Readers</h2>
        <ul className="mt-2 space-y-1">
          {devices.data?.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => {
                  setSelected(d.id);
                  setKeyMsg(null);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected === d.id ? "bg-orange-50 font-semibold text-orange-700 ring-1 ring-inset ring-orange-200" : "hover:bg-stone-50"}`}
              >
                {d.deviceCode} <span className="text-xs text-stone-500">{d.name}</span>
                {!d.isActive && <span className="badge ml-1">off</span>}
              </button>
            </li>
          ))}
        </ul>
        {canManage && (
          <form
            className="mt-4 space-y-2 border-t border-stone-100 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <p className="section-title">Register reader</p>
            <input
              className="input"
              value={form.deviceCode}
              onChange={(e) => setForm({ ...form, deviceCode: e.target.value })}
              placeholder="Code, e.g. FP-01"
              required
            />
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name, e.g. Front desk"
              required
            />
            <input
              className="input"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="Model (when known)"
            />
            {error && (
              <p role="alert" className="alert-error">
                {error}
              </p>
            )}
            <button
              className="btn-primary w-full text-sm"
              type="submit"
              disabled={create.isPending}
            >
              Register
            </button>
          </form>
        )}
      </div>

      <div className="card">
        {!selected && (
          <p className="text-sm text-stone-500">
            Select a reader to inspect health, mappings and sync history.
          </p>
        )}
        {selected && health.data && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">
                {health.data.device.deviceCode} · {health.data.device.name}
              </h2>
              <span className="badge">
                {health.data.device.model ?? "model unknown — adapter mode"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-stone-50 p-3">
                <p className="section-title">Mappings</p>
                <p className="text-xl font-bold">{health.data.activeMappings}</p>
              </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <p className="section-title">Scans today</p>
                <p className="text-xl font-bold">{health.data.eventsToday}</p>
              </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <p className="section-title">Unmapped</p>
                <p className="text-xl font-bold">{health.data.unmappedPending}</p>
              </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <p className="section-title">Last seen</p>
                <p className="text-sm font-medium">
                  {health.data.device.lastSeenAt
                    ? health.data.device.lastSeenAt.slice(0, 16).replace("T", " ")
                    : "never"}
                </p>
              </div>
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                <button
                  className="btn-ghost text-sm"
                  onClick={() => rotate.mutate()}
                  disabled={rotate.isPending}
                >
                  Rotate connector key
                </button>
                <button
                  className="btn-ghost text-sm"
                  onClick={() => simulate.mutate()}
                  disabled={simulate.isPending}
                  title="Dev only — clearly-flagged fake scans"
                >
                  Simulate scans (dev)
                </button>
              </div>
            )}
            {keyMsg && <p className="alert-warn break-all">{keyMsg}</p>}

            <div>
              <h3 className="section-title mb-2">Sync history</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Fetched</th>
                    <th>New</th>
                    <th>Dupes</th>
                    <th>Unmapped</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data?.map((s) => (
                    <tr key={s.id}>
                      <td className="tabular-nums text-xs">
                        {s.startedAt.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="tabular-nums">{s.fetched}</td>
                      <td className="tabular-nums">{s.ingested}</td>
                      <td className="tabular-nums">{s.duplicates}</td>
                      <td className="tabular-nums">{s.unmapped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {runs.data?.length === 0 && (
                <p className="py-2 text-sm text-stone-500">No sync runs yet.</p>
              )}
            </div>

            <div>
              <h3 className="section-title mb-2">User mappings ({mappings.data?.length ?? 0})</h3>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {mappings.data?.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                  >
                    <span className="font-mono">{m.deviceUserId}</span>
                    <span className="text-stone-500">
                      → {m.member ? `${m.member.fullName} (${m.member.memberCode})` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
