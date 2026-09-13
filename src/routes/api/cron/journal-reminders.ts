import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
  const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const { runJournalReminders } = await import("@/lib/reminders.server");
    const result = await runJournalReminders();
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось отправить напоминания" },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/cron/journal-reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
