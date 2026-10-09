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
import { SequenceService } from "./members/sequences.js";
import { MembersService } from "./members/members.service.js";
import { MembersController } from "./members/members.controller.js";
import { PackagesController, PackagesService } from "./members/packages.controller.js";
import { GendersController } from "./members/genders.controller.js";
import { MembershipsService } from "./memberships/memberships.service.js";
import { MembershipsController } from "./memberships/memberships.controller.js";
import { BillingService } from "./billing/billing.service.js";
import { BillingController } from "./billing/billing.controller.js";

@Module({
  imports: [ThrottlerModule.forRoot([{ name: "default", ttl: 60000, limit: 120 }])],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    RolesController,
    MembersController,
    PackagesController,
    GendersController,
    MembershipsController,
    BillingController,
  ],
  providers: [
    PrismaService,
    AuditService,
    AuthService,
    SequenceService,
    MembersService,
    PackagesService,
    MembershipsService,
    BillingService,
    Reflector,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
