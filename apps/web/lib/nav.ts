export interface NavItem {
  href: string;
  label: string;
  perm?: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/members", label: "Members", perm: "members.read" },
  { href: "/enquiries", label: "Enquiries", perm: "enquiries.manage" },
  { href: "/memberships", label: "Memberships", perm: "memberships.create" },
  { href: "/packages", label: "Packages", perm: "memberships.create" },
  { href: "/attendance", label: "Attendance", perm: "attendance.read" },
  { href: "/billing", label: "Billing", perm: "payments.collect" },
  { href: "/reports", label: "Reports", perm: "reports.attendance.read" },
  { href: "/users", label: "Staff", perm: "staff.manage" },
  { href: "/roles", label: "Roles & Permissions", perm: "roles.manage" },
  { href: "/profile", label: "Profile" },
];
