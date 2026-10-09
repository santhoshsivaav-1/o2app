export async function GET() {
  return Response.json({ ok: true, service: "web", time: new Date().toISOString() });
}
