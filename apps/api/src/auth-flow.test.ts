/**
 * Full auth flow against a real database (needs seed to have run).
 * Run: RUN_AUTH_FLOW=1 OWNER_EMAIL=... OWNER_PASSWORD=... node --test dist/auth-flow.test.js
 * Skipped by default (CI sets RUN_AUTH_FLOW=1 with a Postgres service).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "@o2app/shared";

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

async function bootApp(port: number) {
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
  await app.listen(port);
  return { app, prisma: new PrismaClient(), base: `http://localhost:${port}/api/v1` };
}

async function req(
  method: string,
  path: string,
  jar: Jar,
  body?: unknown,
  csrf = true,
): Promise<{ status: number; json: any; jar: Jar }> {
  return reqBase(BASE + path, method, jar, body, csrf);
}

async function reqBase(
  url: string,
  method: string,
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
  const res = await fetch(url, {
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
  const { app, prisma } = await bootApp(PORT);

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

test("phase3: members + packages lifecycle + RBAC", { skip: !RUN }, async () => {
  const FLOW_PORT = PORT + 1;
  const { app, prisma } = await bootApp(FLOW_PORT);
  const base = `http://localhost:${FLOW_PORT}/api/v1`;
  const call = (method: string, path: string, jar: Jar, body?: unknown, csrf = true) =>
    reqBase(base + path, method, jar, body, csrf);
  const createdMemberIds: string[] = [];
  const createdPackageIds: string[] = [];
  let recepId = "";

  try {
    const ownerEmail = process.env.OWNER_EMAIL ?? "";
    const ownerPass = process.env.OWNER_PASSWORD ?? "";
    let r = await call("POST", "/auth/login", {}, { email: ownerEmail, password: ownerPass });
    assert.equal(r.status, 200);
    const owner: Jar = r.jar;

    r = await call("GET", "/genders", owner);
    assert.equal(r.status, 200);
    const male = (r.json as { id: string; name: string }[]).find((g) => g.name === "Male");
    assert.ok(male, "Male gender seeded");

    // Create member -> code issued.
    const payload = { fullName: "Flow Member One", mobile: "+91 90000 11111", genderId: male!.id };
    r = await call("POST", "/members", owner, payload);
    assert.equal(r.status, 201);
    assert.match(r.json.memberCode, /^O2-\d{4}-\d{4}$/);
    const m1 = r.json.id as string;
    createdMemberIds.push(m1);

    // Duplicate mobile blocked, then allowed with explicit confirmation.
    r = await call("POST", "/members", owner, { ...payload, fullName: "Dupe Attempt" });
    assert.equal(r.status, 409);
    assert.ok((r.json.message as string).includes("duplicate"));
    assert.ok((r.json.matches as unknown[]).length >= 1);
    r = await call("POST", "/members", owner, {
      ...payload,
      fullName: "Flow Member Two",
      confirmDuplicate: true,
    });
    assert.equal(r.status, 201);
    createdMemberIds.push(r.json.id as string);
    assert.notEqual(r.json.memberCode, undefined);

    // Search / filter / pagination.
    r = await call("GET", "/members?q=9000011111", owner);
    assert.equal(r.status, 200);
    assert.ok(r.json.meta.total >= 2);
    r = await call("GET", "/members?status=active&limit=1&page=1&sort=memberCode&order=asc", owner);
    assert.equal(r.status, 200);
    assert.equal(r.json.data.length, 1);
    assert.equal(r.json.meta.page, 1);

    // Invalid payload rejected.
    r = await call("POST", "/members", owner, { fullName: "", mobile: "12", genderId: male!.id });
    assert.equal(r.status, 400);

    // Update + note + get.
    r = await call("PATCH", `/members/${m1}`, owner, { notes: "Prefers morning batch" });
    assert.equal(r.status, 200);
    r = await call("POST", `/members/${m1}/notes`, owner, { body: "Called about renewal" });
    assert.equal(r.status, 201);
    r = await call("GET", `/members/${m1}`, owner);
    assert.equal(r.status, 200);
    assert.equal(r.json.memberNotes.length, 1);
    assert.equal(r.json.gender.name, "Male");

    // Archive + restore.
    r = await call("POST", `/members/${m1}/archive`, owner);
    assert.equal(r.status, 201);
    assert.equal(r.json.status, "archived");
    r = await call("POST", `/members/${m1}/restore`, owner);
    assert.equal(r.status, 201);
    assert.equal(r.json.status, "active");

    // Export requires data.export.
    const expRes = await fetch(base + "/members/export", {
      headers: { cookie: `access_token=${owner.access}` },
    });
    assert.equal(expRes.status, 200);
    const csv = await expRes.text();
    assert.ok(csv.startsWith("member_code,full_name"));

    // Packages: create (90 days for 3 months), list, update, deactivate.
    r = await call("POST", "/packages", owner, {
      name: "Flow Quarterly",
      durationValue: 3,
      durationUnit: "MONTH",
      price: 4500,
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.durationDays, 90);
    const pkgId = r.json.id as string;
    createdPackageIds.push(pkgId);
    r = await call("GET", "/packages", owner);
    assert.ok((r.json as unknown[]).some((p: any) => p.id === pkgId));
    r = await call("PATCH", `/packages/${pkgId}`, owner, { price: 4800 });
    assert.equal(r.status, 200);
    r = await call("POST", `/packages/${pkgId}/deactivate`, owner);
    assert.equal(r.status, 201);
    assert.equal(r.json.isActive, false);
    r = await call("GET", "/packages", owner);
    assert.ok(!(r.json as unknown[]).some((p: any) => p.id === pkgId));

    // Receptionist: can register members, cannot manage packages or export.
    const recepRole = await prisma.role.findUniqueOrThrow({ where: { name: "receptionist" } });
    r = await call("POST", "/users", owner, {
      name: "Flow Recep 3",
      email: "flow-recep3@o2.test",
      password: "Recep-Flow-03",
      roleIds: [recepRole.id],
    });
    assert.equal(r.status, 201);
    recepId = r.json.id as string;
    r = await call(
      "POST",
      "/auth/login",
      {},
      { email: "flow-recep3@o2.test", password: "Recep-Flow-03" },
    );
    assert.equal(r.status, 200);
    const recep: Jar = r.jar;
    r = await call("POST", "/members", recep, {
      fullName: "Recep Member",
      mobile: "91111 22222",
      genderId: male!.id,
    });
    assert.equal(r.status, 201);
    createdMemberIds.push(r.json.id as string);
    assert.equal(
      (
        await call("POST", "/packages", recep, {
          name: "X",
          durationValue: 1,
          durationUnit: "MONTH",
          price: 100,
        })
      ).status,
      403,
    );
    assert.equal((await call("GET", "/members/export", recep)).status, 403);
    assert.equal((await call("POST", `/members/${m1}/archive`, recep)).status, 403);
  } finally {
    if (recepId) {
      await prisma.session.deleteMany({ where: { userId: recepId } });
      await prisma.userRole.deleteMany({ where: { userId: recepId } });
      await prisma.user.deleteMany({ where: { id: recepId } });
    }
    await prisma.memberNote.deleteMany({ where: { memberId: { in: createdMemberIds } } });
    await prisma.member.deleteMany({ where: { id: { in: createdMemberIds } } });
    await prisma.package.deleteMany({ where: { id: { in: createdPackageIds } } });
    await app.close();
    await prisma.$disconnect();
  }
});

test("phase4: membership lifecycle + atomic invoices", { skip: !RUN }, async () => {
  const FLOW_PORT = PORT + 2;
  const { app, prisma } = await bootApp(FLOW_PORT);
  const base = `http://localhost:${FLOW_PORT}/api/v1`;
  const call = (method: string, path: string, jar: Jar, body?: unknown, csrf = true) =>
    reqBase(base + path, method, jar, body, csrf);
  const memberIds: string[] = [];
  const packageIds: string[] = [];
  const membershipIds: string[] = [];

  try {
    const ownerEmail = process.env.OWNER_EMAIL ?? "";
    const ownerPass = process.env.OWNER_PASSWORD ?? "";
    let r = await call("POST", "/auth/login", {}, { email: ownerEmail, password: ownerPass });
    assert.equal(r.status, 200);
    const owner: Jar = r.jar;

    r = await call("GET", "/genders", owner);
    const male = (r.json as { id: string; name: string }[]).find((g) => g.name === "Male")!;
    r = await call("POST", "/members", owner, {
      fullName: "Phase Four",
      mobile: "90004 11223",
      genderId: male.id,
    });
    assert.equal(r.status, 201);
    const memberId = r.json.id as string;
    memberIds.push(memberId);

    r = await call("POST", "/packages", owner, {
      name: "Flow Monthly",
      durationValue: 1,
      durationUnit: "MONTH",
      price: 1000,
      registrationFee: 100,
      discountMaxPct: 10,
      gstPercent: 18,
    });
    assert.equal(r.status, 201);
    const packageId = r.json.id as string;
    packageIds.push(packageId);

    // Sale with discount + idempotency.
    const saleBody = { memberId, packageId, discountPct: 10, idempotencyKey: "phase4-sale-1" };
    r = await call("POST", "/memberships", owner, saleBody);
    assert.equal(r.status, 201);
    const m1 = r.json;
    membershipIds.push(m1.id as string);
    assert.equal(Number(m1.total), 1168.2); // (1000+100-110) + 18%
    assert.match(m1.invoice.invoiceNo as string, /^INV-\d{4}-\d{4}$/);
    assert.equal(m1.invoice.items.length, 2);
    assert.equal(m1.invoice.status, "unpaid");
    r = await call("POST", "/memberships", owner, saleBody);
    assert.equal(r.status, 201);
    assert.equal(r.json.id, m1.id);
    assert.equal(r.json.idempotentReplay, true);

    // Discount above package max rejected.
    r = await call("POST", "/memberships", owner, { memberId, packageId, discountPct: 50 });
    assert.equal(r.status, 400);

    // Inactive package blocked for new sales.
    r = await call("POST", `/packages/${packageId}/deactivate`, owner);
    assert.equal(r.status, 201);
    r = await call("POST", "/memberships", owner, { memberId, packageId });
    assert.equal(r.status, 409);

    // Early renewal continues the day after previous end (same inactive package grandfathered).
    const prevEnd: string = m1.endDate.slice(0, 10);
    r = await call("POST", `/memberships/${m1.id}/renew`, owner, {
      idempotencyKey: "phase4-renew-1",
    });
    assert.equal(r.status, 201);
    const m2 = r.json;
    membershipIds.push(m2.id as string);
    assert.ok((m2.startDate as string).startsWith(addDays(prevEnd, 1)));
    assert.equal(m2.invoice.items.length, 2);

    // Renewal with a different inactive package is blocked.
    r = await call("POST", "/packages", owner, {
      name: "Dead Pack",
      durationValue: 1,
      durationUnit: "MONTH",
      price: 500,
    });
    const deadId = r.json.id as string;
    packageIds.push(deadId);
    await call("POST", `/packages/${deadId}/deactivate`, owner);
    r = await call("POST", `/memberships/${m2.id}/renew`, owner, { packageId: deadId });
    assert.equal(r.status, 409);

    // Suspend -> resume keeps validity transitions; extend shifts the end date.
    r = await call("POST", `/memberships/${m2.id}/suspend`, owner, { reason: "travel" });
    assert.equal(r.status, 201);
    assert.equal(r.json.status, "suspended");
    r = await call("GET", `/memberships/by-member/${memberId}/current`, owner);
    assert.equal(r.json.validity, "suspended");
    const endBefore: string = (r.json.membership.endDate as string).slice(0, 10);
    r = await call("POST", `/memberships/${m2.id}/resume`, owner);
    assert.equal(r.status, 201);
    assert.equal(r.json.status, "active");
    r = await call("PATCH", `/memberships/${m2.id}/extend`, owner, {
      days: 30,
      reason: "goodwill",
    });
    assert.equal(r.status, 200);
    assert.equal((r.json.endDate as string).slice(0, 10), addDays(endBefore, 30));

    // Cancel is terminal.
    r = await call("POST", `/memberships/${m2.id}/cancel`, owner, { reason: "moved away" });
    assert.equal(r.status, 201);
    assert.equal(r.json.status, "cancelled");
    assert.equal((await call("POST", `/memberships/${m2.id}/renew`, owner, {})).status, 409);
    assert.equal(
      (await call("PATCH", `/memberships/${m2.id}/extend`, owner, { days: 5 })).status,
      409,
    );

    // List filters + detail carry computed validity.
    r = await call("GET", "/memberships?validity=active", owner);
    assert.equal(r.status, 200);
    assert.ok((r.json.data as unknown[]).some((m: any) => m.id === m1.id));
    r = await call("GET", `/memberships?q=Phase%20Four`, owner);
    assert.ok((r.json.meta as { total: number }).total >= 1);
    r = await call("GET", `/memberships/${m1.id}`, owner);
    assert.equal(r.status, 200);
    assert.ok(r.json.validity);
    assert.ok(r.json.statusHistory.length >= 1);

    // Archived members cannot buy.
    r = await call("POST", `/members/${memberId}/archive`, owner);
    assert.equal(r.status, 201);
    assert.equal(
      (await call("POST", "/memberships", owner, { memberId, packageId: deadId })).status,
      409,
    );
  } finally {
    await prisma.renewalEvent.deleteMany({ where: { membershipId: { in: membershipIds } } });
    await prisma.membershipStatusHistory.deleteMany({
      where: { membershipId: { in: membershipIds } },
    });
    await prisma.invoice.deleteMany({ where: { membership: { id: { in: membershipIds } } } });
    await prisma.membership.deleteMany({ where: { id: { in: membershipIds } } });
    await prisma.package.deleteMany({ where: { id: { in: packageIds } } });
    await prisma.memberNote.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
    await app.close();
    await prisma.$disconnect();
  }
});

test("phase5: payments, refunds, reports", { skip: !RUN }, async () => {
  const FLOW_PORT = PORT + 3;
  const { app, prisma } = await bootApp(FLOW_PORT);
  const base = `http://localhost:${FLOW_PORT}/api/v1`;
  const call = (method: string, path: string, jar: Jar, body?: unknown, csrf = true) =>
    reqBase(base + path, method, jar, body, csrf);
  const memberIds: string[] = [];
  const packageIds: string[] = [];
  const membershipIds: string[] = [];
  const paymentIds: string[] = [];
  let recepId = "";

  const N = (v: unknown) => Number(v);
  try {
    const ownerEmail = process.env.OWNER_EMAIL ?? "";
    const ownerPass = process.env.OWNER_PASSWORD ?? "";
    let r = await call("POST", "/auth/login", {}, { email: ownerEmail, password: ownerPass });
    assert.equal(r.status, 200);
    const owner: Jar = r.jar;

    r = await call("GET", "/genders", owner);
    const male = (r.json as { id: string; name: string }[])[0];
    const mkMember = async (name: string, mobile: string) => {
      const res = await call("POST", "/members", owner, {
        fullName: name,
        mobile,
        genderId: male.id,
      });
      assert.equal(res.status, 201);
      memberIds.push(res.json.id as string);
      return res.json.id as string;
    };
    const m1 = await mkMember("Pay Five", "9000511122");
    const m2 = await mkMember("Pay Other", "9000522233");

    r = await call("POST", "/packages", owner, {
      name: "Flow Pay Pack",
      durationValue: 1,
      durationUnit: "MONTH",
      price: 1000,
      registrationFee: 100,
      gstPercent: 18,
    });
    assert.equal(r.status, 201);
    const pkg = r.json.id as string;
    packageIds.push(pkg);

    const sell = async (memberId: string, key: string) => {
      const res = await call("POST", "/memberships", owner, {
        memberId,
        packageId: pkg,
        idempotencyKey: key,
      });
      assert.equal(res.status, 201);
      membershipIds.push(res.json.id as string);
      return res.json as { id: string; total: string; invoice: { id: string; invoiceNo: string } };
    };
    const s1 = await sell(m1, "p5-s1");
    assert.equal(N(s1.total), 1298); // (1000+100) + 18%

    // 1. Full payment -> paid, outstanding 0.
    const pay = async (body: unknown, jar: Jar = owner) => call("POST", "/payments", jar, body);
    r = await pay({
      memberId: m1,
      method: "cash",
      amount: 1298,
      allocations: [{ invoiceId: s1.invoice.id, amount: 1298 }],
      idempotencyKey: "p5-pay-1",
    });
    assert.equal(r.status, 201);
    const pay1 = (r.json.payment as { id: string }).id as string;
    paymentIds.push(pay1);
    r = await call("GET", `/invoices/${s1.invoice.id}`, owner);
    assert.equal(r.json.status, "paid");
    assert.equal(N(r.json.outstanding), 0);

    // 2. Partials accumulate -> paid.
    const s2 = await sell(m1, "p5-s2");
    r = await pay({
      memberId: m1,
      method: "upi_manual",
      reference: "UPI-REF-1",
      amount: 500,
      allocations: [{ invoiceId: s2.invoice.id, amount: 500 }],
    });
    assert.equal(r.status, 201);
    paymentIds.push((r.json.payment as { id: string }).id as string);
    r = await call("GET", `/invoices/${s2.invoice.id}`, owner);
    assert.equal(r.json.status, "partial");
    assert.equal(N(r.json.outstanding), 798);
    r = await pay({
      memberId: m1,
      method: "cash",
      amount: 798,
      allocations: [{ invoiceId: s2.invoice.id, amount: 798 }],
    });
    assert.equal(r.status, 201);
    paymentIds.push((r.json.payment as { id: string }).id as string);
    r = await call("GET", `/invoices/${s2.invoice.id}`, owner);
    assert.equal(r.json.status, "paid");

    // 3. Overpayment becomes member credit.
    const s3 = await sell(m1, "p5-s3");
    r = await pay({
      memberId: m1,
      method: "cash",
      amount: 1500,
      allocations: [{ invoiceId: s3.invoice.id, amount: 1298 }],
    });
    assert.equal(r.status, 201);
    paymentIds.push((r.json.payment as { id: string }).id as string);
    assert.equal(N(r.json.credit.remaining), 202);

    // 4. Guardrails: overallocation, cross-member, bad method, missing reference.
    assert.equal(
      (
        await pay({
          memberId: m1,
          method: "cash",
          amount: 100,
          allocations: [{ invoiceId: s3.invoice.id, amount: 100 }],
        })
      ).status,
      400,
    );
    const sOther = await sell(m2, "p5-s4");
    assert.equal(
      (
        await pay({
          memberId: m1,
          method: "cash",
          amount: 100,
          allocations: [{ invoiceId: sOther.invoice.id, amount: 100 }],
        })
      ).status,
      400,
    );
    assert.equal((await pay({ memberId: m1, method: "bitcoin", amount: 100 })).status, 400);
    assert.equal((await pay({ memberId: m1, method: "upi_manual", amount: 100 })).status, 400);

    // 5. Idempotent retry + concurrent double-submit -> exactly one payment.
    r = await pay({
      memberId: m1,
      method: "cash",
      amount: 1298,
      allocations: [{ invoiceId: s1.invoice.id, amount: 1 }],
      idempotencyKey: "p5-pay-1",
    });
    assert.ok(r.status === 200 || r.status === 201);
    assert.equal((r.json.payment as { id: string }).id, pay1);
    assert.equal(r.json.idempotentReplay, true);
    const [c1, c2] = await Promise.all([
      pay({ memberId: m1, method: "cash", amount: 50, idempotencyKey: "p5-concurrent" }),
      pay({ memberId: m1, method: "cash", amount: 50, idempotencyKey: "p5-concurrent" }),
    ]);
    assert.ok(
      [200, 201].includes(c1.status) && [200, 201].includes(c2.status),
      `concurrent statuses ${c1.status}/${c2.status}: ${JSON.stringify(c1.json)} ${JSON.stringify(c2.json)}`,
    );
    const cid1 = (c1.json.payment as { id: string } | undefined)?.id;
    const cid2 = (c2.json.payment as { id: string } | undefined)?.id;
    assert.ok(
      cid1 && cid2,
      `both responses carry payment ids: ${JSON.stringify(c1.json).slice(0, 200)}`,
    );
    assert.equal(cid1, cid2);
    paymentIds.push(cid1 as string);
    const dupes = await prisma.payment.count({ where: { idempotencyKey: "p5-concurrent" } });
    assert.equal(dupes, 1);

    // 6. Refunds: partial ok, over-refund blocked, permission gated.
    r = await call("POST", `/payments/${pay1}/refund`, owner, {
      amount: 200,
      reason: "duplicate charge return",
      invoiceId: s1.invoice.id,
    });
    assert.equal(r.status, 201);
    assert.equal(
      (await call("POST", `/payments/${pay1}/refund`, owner, { amount: 5000, reason: "too much" }))
        .status,
      400,
    );
    const recepRole = await prisma.role.findUniqueOrThrow({ where: { name: "receptionist" } });
    r = await call("POST", "/users", owner, {
      name: "Pay Recep",
      email: "pay-recep@o2.test",
      password: "Recep-Pay-05",
      roleIds: [recepRole.id],
    });
    recepId = r.json.id as string;
    r = await call(
      "POST",
      "/auth/login",
      {},
      { email: "pay-recep@o2.test", password: "Recep-Pay-05" },
    );
    const recep: Jar = r.jar;
    assert.equal(
      (await call("POST", `/payments/${pay1}/refund`, recep, { amount: 10, reason: "x" })).status,
      403,
    );
    // receptionist CAN record payments and read invoices.
    r = await call("POST", "/payments", recep, { memberId: m1, method: "cash", amount: 10 });
    assert.equal(r.status, 201);
    paymentIds.push((r.json.payment as { id: string }).id as string);
    assert.equal((await call("GET", `/invoices/${s1.invoice.id}`, recep)).status, 200);

    // 7. Reports reconcile against source records.
    const from = "2020-01-01";
    const to = "2030-12-31";
    r = await call("GET", `/reports/collections?from=${from}&to=${to}`, owner);
    assert.equal(r.status, 200);
    const paid = await prisma.payment.aggregate({ _sum: { amount: true } });
    const ref = await prisma.refund.aggregate({ _sum: { amount: true } });
    assert.equal(r.json.totals.paid, N(paid._sum.amount));
    assert.equal(r.json.totals.refunded, N(ref._sum.amount));
    assert.equal(
      r.json.totals.net,
      Math.round((N(paid._sum.amount) - N(ref._sum.amount)) * 100) / 100,
    );
    r = await call("GET", "/reports/outstanding", owner);
    assert.equal(r.status, 200);
    assert.ok(!(r.json as unknown[]).some((o: any) => o.id === s1.invoice.id));
    r = await call("GET", `/reports/refunds?from=${from}&to=${to}`, owner);
    assert.equal(r.status, 200);
    assert.equal(r.json.total, 200);
    // exports require data.export (owner has it).
    const exp = await fetch(base + "/members/export", { headers: {} });
    assert.ok([401, 403].includes(exp.status)); // no cookie -> rejected
  } finally {
    const payIds = paymentIds.filter(Boolean);
    const memIds = membershipIds.filter(Boolean);
    const mbrIds = memberIds.filter(Boolean);
    const pkgIds = packageIds.filter(Boolean);
    try {
      await prisma.refund.deleteMany({ where: { paymentId: { in: payIds } } });
      await prisma.creditAdjustment.deleteMany({ where: { sourcePaymentId: { in: payIds } } });
      await prisma.payment.deleteMany({ where: { id: { in: payIds } } });
      await prisma.renewalEvent.deleteMany({ where: { membershipId: { in: memIds } } });
      await prisma.membershipStatusHistory.deleteMany({ where: { membershipId: { in: memIds } } });
      await prisma.invoice.deleteMany({ where: { membership: { id: { in: memIds } } } });
      await prisma.membership.deleteMany({ where: { id: { in: memIds } } });
      await prisma.package.deleteMany({ where: { id: { in: pkgIds } } });
      if (recepId) {
        await prisma.session.deleteMany({ where: { userId: recepId } });
        await prisma.userRole.deleteMany({ where: { userId: recepId } });
        await prisma.user.deleteMany({ where: { id: recepId } });
      }
      await prisma.memberNote.deleteMany({ where: { memberId: { in: mbrIds } } });
      await prisma.member.deleteMany({ where: { id: { in: mbrIds } } });
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }
});
