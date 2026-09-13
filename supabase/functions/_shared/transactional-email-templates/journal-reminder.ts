export const journalReminderSubject = "Как прошёл день? Запишите видео";

export function journalReminderHtml(vars: {
  name?: string;
  journalUrl: string;
  settingsUrl: string;
}) {
  const greeting = vars.name?.trim() ? `${vars.name.trim()}, как прошёл день?` : "Как прошёл день?";
  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>${journalReminderSubject}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#f7f3ea;border-radius:20px;">
            <tr>
              <td style="padding:32px 28px;font-family:Georgia,serif;color:#24352c;">
                <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#6b7a70;">Nur Balance</p>
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;">${greeting}</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#4a5a52;">
                  Запишите видео — короткое видео в дневнике, когда будет удобно.
                </p>
                <a href="${vars.journalUrl}" style="display:inline-block;background:#2f6b54;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:15px;">
                  Открыть дневник
                </a>
                <p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#6b7a70;">
                  Это напоминание, которое вы включили в Nur Balance.
                  <a href="${vars.settingsUrl}" style="color:#2f6b54;">Отключить в настройках</a>
                  или
                  <a href="{{ unsubscribe_url }}" style="color:#2f6b54;">отписаться от писем</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
