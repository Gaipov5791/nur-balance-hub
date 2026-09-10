import { supabase } from "@/integrations/supabase/client";
import {
  applyAssignedAccountAccess,
  staffAccessFromRoles,
  type StaffAccess,
} from "@/lib/staff-accounts";

export {
  applyAssignedAccountAccess,
  canAccessModeration,
  normalizeEmail,
  staffAccessFromRoles,
  TEMP_ADMIN_EMAILS,
  TEMP_MEMBER_EMAIL,
  type StaffAccess,
} from "@/lib/staff-accounts";

export const STAFF_ROLES = ["admin", "moderator"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

let assignedAdminSync: Promise<void> | null = null;

function syncAssignedAdminsOnce() {
  if (!assignedAdminSync) {
    assignedAdminSync = supabase.rpc("sync_assigned_admins").then(
      () => undefined,
      () => undefined,
    );
  }
  return assignedAdminSync;
}

/** Reads the signed-in user's roles. Fails closed: errors become no access. */
export async function loadStaffAccess(
  userId: string,
  email?: string | null,
): Promise<StaffAccess> {
  await syncAssignedAdminsOnce();
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const fromRoles = error
    ? { isAdmin: false, isModerator: false, isStaff: false }
    : staffAccessFromRoles((data ?? []).map((row) => row.role));
  return applyAssignedAccountAccess(fromRoles, email);
}
