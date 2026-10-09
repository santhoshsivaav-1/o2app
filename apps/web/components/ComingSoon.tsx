import Link from "next/link";

export default function ComingSoon({ module, phase }: { module: string; phase: string }) {
  return (
    <div className="card max-w-lg">
      <h1 className="text-lg font-semibold">{module}</h1>
      <p className="mt-1 text-sm text-stone-400">
        This module lands in {phase}. Nothing here is mocked — it will appear once its backend,
        database and tests are implemented and verified.
      </p>
      <Link href="/" className="btn-ghost mt-4 inline-flex text-sm">
        ← Back to dashboard
      </Link>
    </div>
  );
}
