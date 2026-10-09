/**
 * Full auth flow against a real database (needs seed to have run).
 * Run: RUN_AUTH_FLOW=1 OWNER_EMAIL=... OWNER_PASSWORD=... node --test dist/auth-flow.test.js
 * Skipped by default (CI sets RUN_AUTH_FLOW=1 with a Postgres service).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const RUN = process.env.RUN_AUTH_FLOW === "1";
const PORT = Number(process.env.AUTH_FLOW_PORT ?? 4111);
const BASE = `http://localhost:${PORT}/api/v1`;

interface Jar {
  access?: string;
  refresh?: string;
  csrf?: string;
}

function stash(setCookies: string[], jar: Jar) {
  for (const c of setCookies) {
    const [pair] = c.split(";");
    const [k, ...rest] = pair.split("=");
    const v = rest.join("=");
    if (k === "access_token") jar.access = v;
    if (k === "refresh_token") jar.refresh = v;
    if (k === "csrf_token") jar.csrf = v;
  }
}

function getSetCookies(res: Response): string[] {
  // undici: getSetCookie() available on Node 20+.
  const fn = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  return typeof fn === "function" ? fn.call(res.headers) : [];
}

async function req(
  method: string,
  path: string,
  jar: Jar,
  body?: unknown,
  csrf = true,
): Promise<{ status: number; json: any; jar: Jar }> {
  const headers: Record<string, string> = {};
  const cookies: string[] = [];
  if (jar.access) cookies.push(`access_token=${jar.access}`);
  if (jar.refresh) cookies.push(`refresh_token=${jar.refresh}`);
  if (jar.csrf) cookies.push(`csrf_token=${jar.csrf}`);
  if (cookies.length > 0) headers.cookie = cookies.join("; ");
  if (csrf && jar.csrf) headers["x-csrf-token"] = jar.csrf;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const next: Jar = { ...jar };
  stash(getSetCookies(res), next);
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, jar: next };
}

test("auth flow: login, RBAC, rotation, logout", { skip: !RUN }, async () => {
  const { NestFactory } = await import("@nestjs/core");
  const cookieParser = (await import("cookie-parser")).default;
  const { ValidationPipe } = await import("@nestjs/common");
  const { AppModule } = await import("./app.module.js");
  const { PrismaClient } = await import("@prisma/client");

  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(cookieParser());
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(PORT);
  const prisma = new PrismaClient();

  try {
    const ownerEmail = process.env.OWNER_EMAIL ?? "";
    const ownerPass = process.env.OWNER_PASSWORD ?? "";
    assert.ok(ownerEmail && ownerPass, "OWNER_EMAIL/OWNER_PASSWORD required");

    // 1. Bad login fails safely.
    let r = await req("POST", "/auth/login", {}, { email: ownerEmail, password: "wrong-0000" });
    assert.equal(r.status, 401);

    // 2. Owner login works.
    r = await req("POST", "/auth/login", {}, { email: ownerEmail, password: ownerPass });
    assert.equal(r.status, 200);
    assert.ok(r.jar.access && r.jar.refresh && r.jar.csrf);
    assert.ok(r.json.user.permissions.includes("staff.manage"));
    const owner: Jar = r.jar;

    // 3. me + users list as owner.
    r = await req("GET", "/auth/me", owner);
    assert.equal(r.status, 200);
    assert.equal(r.json.email, ownerEmail.toLowerCase());

    // 4. Create a receptionist, verify backend 403s.
    const recepRole = await prisma.role.findUniqueOrThrow({ where: { name: "receptionist" } });
    r = await req("POST", "/users", owner, {
      name: "Flow Recep",
      email: "flow-recep@o2.test",
      password: "Recep-Flow-01",
      roleIds: [recepRole.id],
    });
    assert.equal(r.status, 201);
    const recepId = r.json.id;
    r = await req(
      "POST",
      "/auth/login",
      {},
      { email: "flow-recep@o2.test", password: "Recep-Flow-01" },
    );
    assert.equal(r.status, 200);
    const recep: Jar = r.jar;
    assert.equal((await req("GET", "/roles", recep)).status, 403);
    assert.equal((await req("GET", "/users", recep)).status, 403);
    assert.equal((await req("GET", "/auth/me", recep)).status, 200);

    // 5. CSRF enforced, then refresh rotation invalidates the old token.
    assert.equal(
      (
        await req(
          "POST",
          "/auth/change-password",
          recep,
          {
            currentPassword: "Recep-Flow-01",
            newPassword: "Recep-Flow-02",
          },
          false,
        )
      ).status,
      403,
    );
    const rotated = await req("POST", "/auth/refresh", recep);
    assert.equal(rotated.status, 200);
    assert.equal((await req("POST", "/auth/refresh", recep)).status, 401);

    // 6. Logout revokes; me now 401.
    assert.equal((await req("POST", "/auth/logout", rotated.jar)).status, 200);
    assert.equal((await req("GET", "/auth/me", rotated.jar)).status, 401);

    // Cleanup the flow user (audit rows keep plain-string actor ids — no FK block).
    await prisma.session.deleteMany({ where: { userId: recepId } });
    await prisma.userRole.deleteMany({ where: { userId: recepId } });
    await prisma.user.delete({ where: { id: recepId } });
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});
