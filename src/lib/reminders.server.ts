import {
  renderJournalReminderHtml,
  renderJournalReminderText,
  reminderLinks,
} from "@/lib/reminder-email";
import {
  REMINDER_BODY,
  REMINDER_KIND,
  REMINDER_SUBJECT,
  REMINDER_TITLE,
  localDateInZone,
  normalizeReminderTime,
  safeTimeZone,
  shouldSendReminder,
} from "@/lib/reminders";

export type ReminderRunResult = {
  considered: number;
  due: number;
  sent: number;
  skipped: number;
  emails: number;
  errors: string[];
};

type ProfileRow = {
  id: string;
  name: string;
  reminder_enabled: boolean;
  reminder_time: string;
  reminder_timezone: string;
  last_entry_date: string | null;
  last_reminder_sent_on: string | null;
};

function asProfile(row: ProfileRow): ProfileRow {
  return {
    ...row,
    reminder_time: normalizeReminderTime(row.reminder_time),
    reminder_timezone: safeTimeZone(row.reminder_timezone),
  };
}

export async function runJournalReminders(now = new Date()): Promise<ReminderRunResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, name, reminder_enabled, reminder_time, reminder_timezone, last_entry_date, last_reminder_sent_on",
    )
    .eq("reminder_enabled", true);

  if (error) throw new Error("Не удалось прочитать настройки напоминаний");

  const profiles = (data ?? []).map((row) => asProfile(row as ProfileRow));
  const due = profiles.filter((profile) => shouldSendReminder(profile, now));
  const result: ReminderRunResult = {
    considered: profiles.length,
    due: due.length,
    sent: 0,
    skipped: 0,
    emails: 0,
    errors: [],
  };

  for (const profile of due) {
    const localDate = localDateInZone(now, profile.reminder_timezone);
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_journal_reminder", {
      _user_id: profile.id,
      _local_date: localDate,
    });
    if (claimError || claimed !== true) {
      result.skipped += 1;
      continue;
    }

    const { error: notifyError } = await supabaseAdmin.from("notifications").insert({
      user_id: profile.id,
      kind: REMINDER_KIND,
      title: REMINDER_TITLE,
      body: REMINDER_BODY,
      link: "/journal",
    });
    if (notifyError) {
      result.errors.push(`notify:${profile.id}`);
    }

    try {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
        profile.id,
      );
      const email = userData.user?.email;
      if (userError || !email) {
        result.errors.push(`email-missing:${profile.id}`);
      } else {
        await sendJournalReminderEmail({ to: email, name: profile.name });
        result.emails += 1;
      }
    } catch (cause) {
      result.errors.push(cause instanceof Error ? cause.message : `email:${profile.id}`);
    }

    result.sent += 1;
  }

  return result;
}

export async function sendJournalReminderEmail(input: { to: string; name: string }) {
  const links = reminderLinks();
  const payload = {
    to: input.to,
    template: "journal-reminder",
    subject: REMINDER_SUBJECT,
    html: renderJournalReminderHtml({ name: input.name, ...links }),
    text: renderJournalReminderText({ name: input.name, ...links }),
    data: { name: input.name, ...links },
  };

  const resendKey = process.env["RESEND_API_KEY"];
  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env["REMINDER_FROM_EMAIL"] ?? "Nur Balance <noreply@nur-balance-hub.lovable.app>",
        to: [input.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Не удалось отправить письмо (${response.status})`);
    }
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.functions.invoke("send-transactional-email", {
    body: payload,
  });
  if (error) throw new Error(error.message || "Не удалось отправить письмо");
}
