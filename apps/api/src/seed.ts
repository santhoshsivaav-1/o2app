/**
 * One-time bootstrap: seed permissions + default roles, create the initial owner.
 * Safe to re-run (idempotent for permissions/roles; owner created only if none exists).
 *
 * Usage:
 *   OWNER_EMAIL=owner@o2.example OWNER_PASSWORD='ChangeMe123!' pnpm --filter @o2app/api seed
 */
import { PrismaClient } from "@prisma/client";
import { PERMISSIONS, ROLE_DEFAULTS } from "@o2app/shared";
import { assertPasswordPolicy, hashPassword } from "./crypto.js";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3) ?? process.env[name.toUpperCase()];
}

async function main() {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  for (const [name, perms] of Object.entries(ROLE_DEFAULTS)) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const rows = await prisma.permission.findMany({ where: { key: { in: perms as string[] } } });
    await prisma.rolePermission.createMany({
      data: rows.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
    console.log(`role ${name}: ${rows.length} permissions`);
  }

  const ownerCount = await prisma.userRole.count({ where: { role: { name: "owner" } } });
  const email = arg("email") ?? arg("owner_email");
  const password = arg("password") ?? arg("owner_password");
  if (ownerCount === 0) {
    if (!email || !password) {
      console.log("No owner exists. Re-run with OWNER_EMAIL and OWNER_PASSWORD to create one.");
      return;
    }
    assertPasswordPolicy(password);
    const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: "owner" } });
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: "Owner",
        passwordHash: await hashPassword(password),
        userRoles: { create: { roleId: ownerRole.id } },
      },
    });
    console.log(`owner created: ${user.email}`);
  } else {
    console.log(`owner already exists (${ownerCount}) — skipping creation`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
