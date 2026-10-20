<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Therapist contact details live only in admin-restricted `therapist_contacts`, never in public `therapists.bio` or `contact_email`, because signed-in clients can read full catalog rows directly.
The launch video is an app-wide client-only overlay backed by CDN asset pointers and sessionStorage, so auth redirects stay untouched and internal navigation never replays it.
- NurAI daily message limit is enforced server-side by `consume_ai_message()` reading `ai_daily_limit(uid)`, which checks `has_active_subscription()`; payments only write `subscriptions`, so chat and analyzer code stay plan-agnostic.
- Nur-Coins balance changes only inside definer SQL (`coin_wallet` lazy refill, `start_ai_analysis` charge, service-role-only `complete_/fail_ai_analysis` with refund); the AI call runs in `runAnalysis` between start and complete, so a failed AI call never costs coins.
- The daily question is derived deterministically from the local date and the `daily_questions` bank (no per-entry storage), so home, journal and archive always agree.
- Mood colors live only in `--mood-1..5` tokens and `MOOD_LEVELS` (`src/lib/mood.ts`); old journal moods map onto that scale via `JOURNAL_MOOD_LEVEL`, so every calendar and chart shares one palette.
- Mood check-ins are stored in `mood_checkins` with emotion/activity ids (built-in catalog in code, custom ones as `c:<label>` in `custom_tags`), so the catalog can grow without migrations and the future analyzer reads one table.
