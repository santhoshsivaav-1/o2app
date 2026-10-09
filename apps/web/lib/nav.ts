export interface NavItem {
  href: string;
  label: string;
  perm?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "Front desk",
    items: [
      { href: "/members", label: "Members", perm: "members.read" },
      { href: "/enquiries", label: "Enquiries", perm: "enquiries.manage" },
      { href: "/memberships", label: "Memberships", perm: "memberships.create" },
      { href: "/packages", label: "Packages", perm: "memberships.create" },
      { href: "/attendance", label: "Attendance", perm: "attendance.read" },
      { href: "/billing", label: "Billing", perm: "payments.collect" },
    ],
  },
  {
    title: "Insights",
    items: [{ href: "/reports", label: "Reports", perm: "reports.attendance.read" }],
  },
  {
    title: "Administration",
    items: [
      { href: "/users", label: "Staff", perm: "staff.manage" },
      { href: "/roles", label: "Roles & Permissions", perm: "roles.manage" },
      { href: "/profile", label: "Profile" },
    ],
  },
];

/** Flat list for title lookup. */
export const NAV = NAV_GROUPS.flatMap((g) => g.items);
