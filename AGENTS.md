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
- NurAI daily message limit is enforced server-side by `consume_ai_message()` reading `ai_daily_limit(uid)`; subscriptions change only that function, so the chat code stays plan-agnostic.
- AI analysis charges up front in `start_ai_analysis()` and refunds via `fail_ai_analysis()`, which clients can also call; the server returns the result only after `finish_ai_analysis()` succeeds, so a client-triggered refund never yields a free analysis.
- Purchases are credited only by `_fulfill_payment()`, which runs once per `payments` row; prices live in `create_payment()`, and the client-callable `confirm_demo_payment()` refuses non-demo rows, so switching to Kaspi Pay means a provider webhook calling `_fulfill_payment()` with no client path to free coins.
- The daily question is derived deterministically from the local date and the `daily_questions` bank (no per-entry storage), so home, journal and archive always agree.
