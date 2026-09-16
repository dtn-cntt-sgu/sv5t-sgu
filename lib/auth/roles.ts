export const ROLES = [
  "STUDENT",
  "FACULTY_SECRETARY",
  "SCHOOL_PRESIDENT",
  "SUPER_ADMIN",
] as const;

export type UserRole = (typeof ROLES)[number];

export const managerRoles: UserRole[] = [
  "FACULTY_SECRETARY",
  "SCHOOL_PRESIDENT",
];

export function homeForRole(role: UserRole) {
  if (role === "SUPER_ADMIN") return "/admin";
  if (managerRoles.includes(role)) return "/manager";
  return "/dashboard";
}
