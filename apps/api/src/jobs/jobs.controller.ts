import { Controller, Post, Headers, UnauthorizedException } from "@nestjs/common";
import { JobsService } from "./jobs.service.js";
import { Public } from "../auth/guards.js";

@Controller("jobs")
export class JobsController {
  constructor(private jobs: JobsService) {}

  // Protected by a secret header, meant to be called by a CRON scheduler (e.g. Neon Functions)
  @Public() // Bypass JWT since it's a machine-to-machine call
  @Post("reminders")
  async triggerReminders(@Headers("x-jobs-secret") secret: string) {
    if (!secret || secret !== process.env.JOBS_SECRET) {
      throw new UnauthorizedException("Invalid jobs secret");
    }
    return this.jobs.processReminders();
  }
}
