import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { AuditService } from "../audit.service.js";
import { assertPasswordPolicy, hashPassword, verifyPassword } from "../crypto.js";
import {
  csrfForSession,
  hashToken,
  newSessionId,
  signAccess,
  signRefresh,
  verifyRefresh,
} from "../tokens.js";

const MAX_FAILS = 5;
const LOCK_MIN = 15;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  sessionId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private env(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env ${name}`);
    return v;
  }

  async permissionsFor(userId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { userRoles: { some: { userId } } } },
      include: { permission: true },
    });
    return [...new Set(rows.map((r) => r.permission.key))];
  }

  async rolesFor(userId: string) {
    return this.prisma.role.findMany({
      where: { userRoles: { some: { userId } } },
      select: { id: true, name: true },
    });
  }

  private async issueSession(userId: string): Promise<SessionTokens> {
    const sessionId = newSessionId();
    const accessToken = signAccess(sessionId, userId, this.env("JWT_ACCESS_SECRET"));
    const refreshToken = signRefresh(sessionId, userId, this.env("JWT_REFRESH_SECRET"));
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    return {
      accessToken,
      refreshToken,
      csrfToken: csrfForSession(sessionId, this.env("CSRF_SECRET")),
      sessionId,
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Generic failure — never reveal whether the email exists.
    const fail = async (reason: string) => {
      await this.audit.log(`auth.login_failed:${reason}`, "user", user?.id, user?.id);
      throw new UnauthorizedException("Invalid email or password");
    };
    if (!user) return fail("unknown_email");
    if (!user.isActive) return fail("disabled");
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new UnauthorizedException("Account temporarily locked — try again later");
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      const failedAttempts = user.failedAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts,
          lockedUntil:
            failedAttempts >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60 * 1000) : undefined,
        },
      });
      return fail(failedAttempts >= MAX_FAILS ? "locked" : "bad_password");
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const tokens = await this.issueSession(user.id);
    await this.audit.log("auth.login", "user", user.id, user.id);
    return {
      tokens,
      user: await this.publicUser(user.id),
    };
  }

  async publicUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("Account not found");
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: await this.rolesFor(userId),
      permissions: await this.permissionsFor(userId),
    };
  }

  async refresh(refreshToken: string) {
    let claims;
    try {
      claims = verifyRefresh(refreshToken, this.env("JWT_REFRESH_SECRET"));
    } catch {
      throw new UnauthorizedException("Session expired — please log in again");
    }
    const session = await this.prisma.session.findUnique({ where: { id: claims.sid } });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.refreshHash !== hashToken(refreshToken) ||
      session.userId !== claims.sub
    )
      throw new UnauthorizedException("Session expired — please log in again");
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException("Account disabled");
    // Rotation: revoke the old session, issue a fresh one.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.issueSession(user.id);
    await this.audit.log("auth.refresh", "session", session.id, user.id);
    return { tokens, user: await this.publicUser(user.id) };
  }

  async logout(refreshToken: string | undefined, userId?: string) {
    if (!refreshToken) return;
    try {
      const claims = verifyRefresh(refreshToken, this.env("JWT_REFRESH_SECRET"));
      await this.prisma.session.updateMany({
        where: { id: claims.sid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log("auth.logout", "session", claims.sid, userId);
    } catch {
      // Logout is best-effort — never fail it.
    }
  }

  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log("auth.logout_all", "user", userId, userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("Account not found");
    if (!(await verifyPassword(user.passwordHash, currentPassword)))
      throw new UnauthorizedException("Current password is incorrect");
    try {
      assertPasswordPolicy(newPassword);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await this.audit.log("auth.password_change", "user", userId, userId);
  }

  async adminReset(adminId: string, targetUserId: string, newPassword: string) {
    try {
      assertPasswordPolicy(newPassword);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new UnauthorizedException("User not found");
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash: await hashPassword(newPassword),
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    await this.prisma.session.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log("auth.admin_reset", "user", targetUserId, adminId);
  }
}
