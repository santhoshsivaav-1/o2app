import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { AdminResetDto, ChangePasswordDto, LoginDto } from "./dto.js";
import { Public, RequestUser, RequirePermissions } from "./guards.js";
import { csrfForSession } from "../tokens.js";

function setSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string },
) {
  const isProd = (process.env.NODE_ENV ?? "development") === "production";
  const base = {
    httpOnly: true,
    secure: isProd, // Secure cookies also work on http://localhost in modern browsers
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  };
  res.cookie("access_token", tokens.accessToken, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie("refresh_token", tokens.refreshToken, {
    ...base,
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 3600 * 1000,
  });
  res.cookie("csrf_token", tokens.csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/v1/auth" });
  res.clearCookie("csrf_token", { path: "/" });
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** SPA bootstrap: readable CSRF cookie for logged-in sessions (also set at login). */
  @Get("csrf")
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as RequestUser | undefined;
    if (user) {
      res.cookie("csrf_token", csrfForSession(user.sessionId, process.env.CSRF_SECRET ?? ""), {
        httpOnly: false,
        maxAge: 7 * 24 * 3600 * 1000,
      });
    }
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { tokens, user } = await this.auth.login(dto.email, dto.password);
    setSessionCookies(res, tokens);
    return { user };
  }

  @Public()
  @HttpCode(200)
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { tokens, user } = await this.auth.refresh(req.cookies?.["refresh_token"]);
    setSessionCookies(res, tokens);
    return { user };
  }

  @HttpCode(200)
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as RequestUser | undefined;
    await this.auth.logout(req.cookies?.["refresh_token"], user?.id);
    clearSessionCookies(res);
    return { ok: true };
  }

  @HttpCode(200)
  @Post("logout-all")
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as RequestUser;
    await this.auth.logoutAll(user.id);
    clearSessionCookies(res);
    return { ok: true };
  }

  @Get("me")
  me(@Req() req: Request) {
    return this.auth.publicUser((req.user as RequestUser).id);
  }

  @HttpCode(200)
  @Post("change-password")
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(
      (req.user as RequestUser).id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }

  @HttpCode(200)
  @RequirePermissions("staff.manage")
  @Post("users/:id/admin-reset")
  async adminReset(@Req() req: Request, @Body() dto: AdminResetDto) {
    const id = (req.params as Record<string, string>).id;
    await this.auth.adminReset((req.user as RequestUser).id, id, dto.newPassword);
    return { ok: true };
  }
}
