import Link from "next/link";

export default function ComingSoon({ module, phase }: { module: string; phase: string }) {
  return (
    <div className="max-w-lg">
      <h1 className="page-title">{module}</h1>
      <p className="page-sub">Arriving with {phase}</p>
      <div className="card mt-4 flex gap-3">
        <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
        <div>
          <p className="text-sm text-stone-700">
            This module isn&apos;t available yet. It ships only when its backend, database and tests
            are implemented and verified — nothing here is mocked.
          </p>
          <Link href="/" className="btn-ghost mt-4 inline-flex text-sm">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
