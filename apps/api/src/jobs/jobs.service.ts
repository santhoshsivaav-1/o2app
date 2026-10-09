import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private prisma: PrismaService) {}

  async processReminders() {
    this.logger.log("Starting reminder job process...");
    
    // Find memberships expiring in exactly 3 days
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    
    const expiring = await this.prisma.membership.findMany({
      where: {
        status: "active",
        endDate: {
          gte: new Date(targetDate.setHours(0,0,0,0)),
          lte: new Date(targetDate.setHours(23,59,59,999)),
        }
      },
      include: { member: true }
    });

    for (const mem of expiring) {
      this.logger.log(`Reminder: Membership ${mem.id} for ${mem.member.fullName} expires soon.`);
      // TODO: Integrate with SMS/Email provider here
    }

    return { processed: expiring.length };
  }
}
