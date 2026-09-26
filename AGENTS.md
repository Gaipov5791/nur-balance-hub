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
