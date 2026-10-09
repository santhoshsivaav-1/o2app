import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "./health.controller.js";
import { PrismaService } from "./prisma.service.js";
import { AuditService } from "./audit.service.js";
import { AuthService } from "./auth/auth.service.js";
import { AuthController } from "./auth/auth.controller.js";
import { UsersController } from "./auth/users.controller.js";
import { RolesController } from "./auth/roles.controller.js";
import { CsrfGuard, JwtAuthGuard, PermissionsGuard } from "./auth/guards.js";

@Module({
  imports: [ThrottlerModule.forRoot([{ name: "default", ttl: 60000, limit: 120 }])],
  controllers: [HealthController, AuthController, UsersController, RolesController],
  providers: [
    PrismaService,
    AuditService,
    AuthService,
    Reflector,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
