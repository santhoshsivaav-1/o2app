"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ApiError, apiFetch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import {
  SourceBadge,
  type AttendanceRecordRow,
  type DeviceRow,
  type UnmappedRow,
} from "../../../components/attendance";

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

function DailyTab() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["attendance-daily", date, q],
    queryFn: () =>
      apiFetch<{ data: AttendanceRecordRow[]; meta: { total: number } }>(
        `/attendance/daily?date=${date}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      ),
  });

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Date</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="min-w-52 flex-1">
          <label className="label">Search present members</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, code or mobile"
          />
        </div>
        <span className="badge">{list.data?.meta.total ?? 0} check-ins</span>
      </div>
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Check-in</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.data.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link
                    href={`/members/${a.member.id}`}
                    className="font-medium text-stone-900 hover:text-brand-700"
                  >
                    {a.member.fullName}
                  </Link>
                  <p className="text-xs text-stone-500">{a.member.memberCode}</p>
                </td>
                <td className="tabular-nums">{a.checkInAt.slice(11, 16)}</td>
                <td>
                  <SourceBadge source={a.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.isLoading && <p className="p-4 text-sm text-stone-500">Loading…</p>}
        {list.data?.data.length === 0 && (
          <p className="p-8 text-center text-sm text-stone-500">
            No check-ins recorded for this date.
          </p>
        )}
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
