/** Desktop developer + customer. Add/remove emails here. */
export const TEMP_ADMIN_EMAILS = [
  "bakyt.gaipov.kk@gmail.com",
  "eskarinovaayaulym00@mail.ru",
] as const;

/** Phone account: ordinary member, never staff. */
export const TEMP_MEMBER_EMAIL = "gaipovbakyt097@gmail.com";

export type StaffAccess = {
  isAdmin: boolean;
  isModerator: boolean;
  isStaff: boolean;
};

export function normalizeEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

export function isAssignedAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  return TEMP_ADMIN_EMAILS.some((item) => item === normalized);
}

export function staffAccessFromRoles(roles: readonly string[]): StaffAccess {
  const isAdmin = roles.includes("admin");
  const isModerator = roles.includes("moderator");
  return { isAdmin, isModerator, isStaff: isAdmin || isModerator };
}

/** Assigned admin emails get moderation; the phone account never does. */
export function applyAssignedAccountAccess(
  access: StaffAccess,
  email: string | null | undefined,
): StaffAccess {
  const normalized = normalizeEmail(email);
  if (normalized === TEMP_MEMBER_EMAIL) {
    return { isAdmin: false, isModerator: false, isStaff: false };
  }
  if (isAssignedAdminEmail(normalized)) {
    return { isAdmin: true, isModerator: access.isModerator, isStaff: true };
  }
  return access;
}

/** Nav and `/moderation` are admin-only. Moderators do not see or enter the section. */
export function canAccessModeration(access: Pick<StaffAccess, "isAdmin">): boolean {
  return access.isAdmin;
}
