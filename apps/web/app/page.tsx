export default function Home() {
  return (
    <main style={{ padding: 32 }}>
      <h1>o2app — Gym Management (Phase 1)</h1>
      <p>API: {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}</p>
      <p>
        Health: <a href="/healthz">/healthz</a> · API docs: /api/docs on the API service
      </p>
    </main>
  );
}
