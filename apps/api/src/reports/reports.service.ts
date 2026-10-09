import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getOwnerDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Business Overview
    const totalMembers = await this.prisma.member.count();
    const activeMembers = await this.prisma.membership.count({
      where: { status: "active", endDate: { gte: today } },
    });
    const expiredMemberships = await this.prisma.membership.count({
      where: { status: "expired" },
    });
    
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expiringIn7Days = await this.prisma.membership.count({
      where: { status: "active", endDate: { gte: today, lte: sevenDaysFromNow } },
    });

    // Financial Overview
    const todayPayments = await this.prisma.payment.aggregate({
      where: { paidAt: { gte: today } },
      _sum: { amount: true },
    });
    
    const monthPayments = await this.prisma.payment.aggregate({
      where: { paidAt: { gte: firstDayOfMonth } },
      _sum: { amount: true },
    });

    const outstandingInvoices = await this.prisma.invoice.aggregate({
      where: { status: { in: ["unpaid", "partial"] } },
      _sum: { total: true },
    });

    const monthRefunds = await this.prisma.refund.aggregate({
      where: { createdAt: { gte: firstDayOfMonth } },
      _sum: { amount: true },
    });

    // Attendance & Acquisition
    const todayCheckIns = await this.prisma.attendanceRecord.count({
      where: { date: today },
    });

    const newRegistrations = await this.prisma.member.count({
      where: { registrationDate: { gte: today } },
    });

    const newEnquiries = await this.prisma.enquiry.count({
      where: { enquiryDate: { gte: today } },
    });

    const overdueFollowUps = await this.prisma.followUp.count({
      where: { dueAt: { lt: today }, doneAt: null },
    });

    return {
      business: {
        totalMembers,
        activeMembers,
        expiredMemberships,
        expiringIn7Days,
      },
      financial: {
        todayCollections: todayPayments._sum.amount || 0,
        monthCollections: monthPayments._sum.amount || 0,
        outstandingBalance: outstandingInvoices._sum.total || 0,
        monthRefunds: monthRefunds._sum.amount || 0,
      },
      attendance: {
        todayCheckIns,
        newRegistrations,
        newEnquiries,
        overdueFollowUps,
      },
    };
  }

  async getMembershipExpiryReport(days: number = 30) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    return this.prisma.membership.findMany({
      where: {
        status: "active",
        endDate: {
          lte: targetDate,
          gte: new Date(),
        },
      },
      include: {
        member: {
          select: { id: true, fullName: true, mobileNorm: true },
        },
        package: {
          select: { id: true, name: true },
        },
      },
      orderBy: { endDate: "asc" },
    });
  }

  async getMonthlyDemographics(startDate?: string, endDate?: string) {
    const defaultStart = new Date();
    defaultStart.setDate(1);
    defaultStart.setHours(0,0,0,0);
    const start = startDate ? new Date(startDate) : defaultStart;
    
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23,59,59,999);

    const maleCat = await this.prisma.genderCategory.findFirst({ where: { name: 'Male' } });
    const femaleCat = await this.prisma.genderCategory.findFirst({ where: { name: 'Female' } });

    const newMen = maleCat ? await this.prisma.member.count({
      where: { genderId: maleCat.id, registrationDate: { gte: start, lte: end } }
    }) : 0;

    const newWomen = femaleCat ? await this.prisma.member.count({
      where: { genderId: femaleCat.id, registrationDate: { gte: start, lte: end } }
    }) : 0;

    const renewedMen = maleCat ? await this.prisma.renewalEvent.count({
      where: { createdAt: { gte: start, lte: end }, membership: { member: { genderId: maleCat.id } } }
    }) : 0;

    const renewedWomen = femaleCat ? await this.prisma.renewalEvent.count({
      where: { createdAt: { gte: start, lte: end }, membership: { member: { genderId: femaleCat.id } } }
    }) : 0;

    return {
      range: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
      newRegistrations: { men: newMen, women: newWomen },
      renewals: { men: renewedMen, women: renewedWomen },
    };
  }

  async getEnquiriesReport(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    if (end) end.setHours(23,59,59,999);

    const enquiries = await this.prisma.enquiry.findMany({
      where: start && end ? { enquiryDate: { gte: start, lte: end } } : undefined,
      take: start && end ? undefined : 50,
      orderBy: { enquiryDate: 'desc' },
      include: { assignedTo: { select: { name: true } }, interestPackage: { select: { name: true } } }
    });

    const followUps = await this.prisma.followUp.findMany({
      where: { doneAt: null, dueAt: { lte: new Date() } },
      include: { enquiry: { select: { name: true, phoneNorm: true } } }
    });

    return {
      recentEnquiries: enquiries,
      overdueFollowUps: followUps,
    };
  }

  async getBillingsReport(startDate?: string, endDate?: string) {
    const defaultStart = new Date();
    defaultStart.setDate(1);
    defaultStart.setHours(0,0,0,0);
    const start = startDate ? new Date(startDate) : defaultStart;
    
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23,59,59,999);

    const packageSales = await this.prisma.membership.groupBy({
      by: ['packageId'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { id: true },
      _sum: { total: true }
    });

    const packages = await this.prisma.package.findMany();
    const packageMap = new Map(packages.map(p => [p.id, p.name]));

    const salesByPackage = packageSales.map((ps: any) => ({
      packageName: packageMap.get(ps.packageId) || 'Unknown',
      count: ps._count.id,
      revenue: ps._sum.total || 0,
    }));

    return {
      range: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
      packagePerformance: salesByPackage,
    };
  }

  async getDailyCollections(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0,0,0,0));
    const end = endDate ? new Date(endDate) : new Date(new Date().setHours(23,59,59,999));
    
    return this.prisma.payment.findMany({
      where: { paidAt: { gte: start, lte: end } },
      include: {
        member: { select: { fullName: true, memberCode: true } }
      },
      orderBy: { paidAt: "desc" }
    });
  }

  async getOutstandingBalances() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: ["unpaid", "partial"] } },
      include: {
        member: { select: { fullName: true, memberCode: true, mobileNorm: true } },
        allocations: { select: { amount: true } }
      },
      orderBy: { issuedAt: "asc" }
    });

    return invoices.map(inv => {
      const paid = inv.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
      const due = Number(inv.total) - paid;
      return {
        ...inv,
        paidAmount: paid,
        dueAmount: due,
      };
    });
  }

  async getAttendanceReport(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0,0,0,0));
    const end = endDate ? new Date(endDate) : new Date(new Date().setHours(23,59,59,999));

    const checkIns = await this.prisma.attendanceRecord.findMany({
      where: { date: { gte: start, lte: end } },
      include: {
        member: { select: { fullName: true, memberCode: true, mobileNorm: true } }
      },
      orderBy: { checkInAt: "desc" }
    });

    // Find absentees (Active members who haven't checked in within the last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCheckIns = await this.prisma.attendanceRecord.findMany({
      where: { date: { gte: sevenDaysAgo } },
      select: { memberId: true }
    });
    const activeMemberIdsWithCheckIns = new Set(recentCheckIns.map(r => r.memberId));

    const allActiveMemberships = await this.prisma.membership.findMany({
      where: { status: "active" },
      include: { member: { select: { id: true, fullName: true, mobileNorm: true, memberCode: true } } }
    });

    const absentees = allActiveMemberships
      .filter(m => !activeMemberIdsWithCheckIns.has(m.memberId))
      .map(m => m.member);
      
    // Deduplicate absentees (since one member could have multiple active memberships somehow)
    const uniqueAbsentees = Array.from(new Map(absentees.map(a => [a.id, a])).values());

    return {
      checkIns,
      absentees: uniqueAbsentees,
    };
  }
}
