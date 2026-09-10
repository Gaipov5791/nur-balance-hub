import { describe, expect, it } from "vitest";
import {
  applyAssignedAccountAccess,
  canAccessModeration,
  staffAccessFromRoles,
  TEMP_ADMIN_EMAILS,
  TEMP_MEMBER_EMAIL,
} from "./staff-accounts";

describe("staffAccessFromRoles", () => {
  it("marks admin and moderator as staff, but only admin as admin", () => {
    expect(staffAccessFromRoles(["user"]).isStaff).toBe(false);
    expect(staffAccessFromRoles(["therapist"]).isStaff).toBe(false);
    expect(staffAccessFromRoles([]).isStaff).toBe(false);
    expect(staffAccessFromRoles(["admin"]).isStaff).toBe(true);
    expect(staffAccessFromRoles(["moderator"]).isStaff).toBe(true);
    expect(staffAccessFromRoles(["admin"]).isAdmin).toBe(true);
    expect(staffAccessFromRoles(["moderator"]).isAdmin).toBe(false);
  });
});

describe("applyAssignedAccountAccess", () => {
  it("makes the developer and customer admins, and the phone account a regular user", () => {
    const none = staffAccessFromRoles([]);
    const adminRow = staffAccessFromRoles(["admin"]);

    expect(applyAssignedAccountAccess(none, TEMP_ADMIN_EMAILS[0]).isAdmin).toBe(true);
    expect(applyAssignedAccountAccess(none, "  Bakyt.Gaipov.KK@gmail.com ").isAdmin).toBe(true);
    expect(applyAssignedAccountAccess(none, "eskarinovaayaulym00@mail.ru").isAdmin).toBe(true);
    expect(applyAssignedAccountAccess(adminRow, TEMP_MEMBER_EMAIL).isAdmin).toBe(false);
    expect(applyAssignedAccountAccess(adminRow, TEMP_MEMBER_EMAIL).isStaff).toBe(false);
    expect(applyAssignedAccountAccess(none, "someone@example.com").isAdmin).toBe(false);
  });
});

describe("canAccessModeration", () => {
  it("allows only the admin role into the moderation section", () => {
    expect(canAccessModeration(staffAccessFromRoles(["admin"]))).toBe(true);
    expect(canAccessModeration(staffAccessFromRoles(["moderator"]))).toBe(false);
    expect(canAccessModeration(staffAccessFromRoles(["user"]))).toBe(false);
    expect(canAccessModeration(staffAccessFromRoles([]))).toBe(false);
  });
});
