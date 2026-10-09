import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma.service.js";
import { newCsrfCompare, verifyAccess } from "../tokens.js";

export interface RequestUser {
  id: string;
  sessionId: string;
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export const PERMS_KEY = "requiredPermissions";
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMS_KEY, perms);

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

function readAccessToken(req: any): string | undefined {
  const cookie = req.cookies?.["access_token"];
  if (cookie) return cookie;
  const h = req.headers?.["authorization"];
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7);
  return undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])
    )
      return true;
    const req = ctx.switchToHttp().getRequest();
    const token = readAccessToken(req);
    if (!token) throw new UnauthorizedException("Not authenticated");
    let claims;
    try {
      claims = verifyAccess(token, process.env.JWT_ACCESS_SECRET ?? "");
    } catch {
      throw new UnauthorizedException("Session expired — please log in again");
    }
    const session = await this.prisma.session.findUnique({ where: { id: claims.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date())
      throw new UnauthorizedException("Session revoked — please log in again");
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException("Account disabled");
    const permissions = await this.permissionsFor(user.id);
    req.user = { id: user.id, sessionId: session.id, permissions } satisfies RequestUser;
    return true;
  }

  private async permissionsFor(userId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { userRoles: { some: { userId } } } },
      include: { permission: true },
    });
    return [...new Set(rows.map((r) => r.permission.key))];
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [ctx.getHandler(), ctx.getClass()]) ??
      [];
    if (required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as RequestUser | undefined;
    if (!user) throw new UnauthorizedException("Not authenticated");
    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length > 0)
      throw new ForbiddenException(`Missing permission: ${missing.join(", ")}`);
    return true;
  }
}

/** Double-submit CSRF: mutating routes must send x-csrf-token matching the session-bound token. */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return true;
    const p: string = req.path ?? req.url ?? "";
    if (p.endsWith("/auth/login")) return true; // session-establishing call, no session yet
    const sent = req.headers?.["x-csrf-token"];
    const expectedCookie = req.cookies?.["csrf_token"];
    if (typeof sent !== "string" || typeof expectedCookie !== "string" || !sent)
      throw new ForbiddenException("Missing CSRF token");
    if (!newCsrfCompare(sent, expectedCookie)) throw new ForbiddenException("Invalid CSRF token");
    return true;
  }
}
