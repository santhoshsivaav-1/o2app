import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    if (process.env.SKIP_DB === "1") return;
    await this.$connect().catch(() => undefined);
  }
  async onModuleDestroy() {
    await this.$disconnect().catch(() => undefined);
  }
}
