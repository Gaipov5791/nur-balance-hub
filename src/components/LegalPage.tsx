import { Link } from "@tanstack/react-router";
import { LEGAL_DOCS } from "@/content/legal";

type Kind = keyof typeof LEGAL_DOCS;

const isHeading = (t: string) => /^\d+\.\s+[А-ЯЁA-Z\s,«»—-]+$/.test(t);

export function LegalPage({ kind }: { kind: Kind }) {
  const [title, subtitle, ...rest] = LEGAL_DOCS[kind];
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-foreground">
      <nav className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link to="/" className="text-primary underline-offset-4 hover:underline">← На главную</Link>
        <Link to="/terms" className="text-muted-foreground hover:text-primary">Оферта</Link>
        <Link to="/privacy" className="text-muted-foreground hover:text-primary">Конфиденциальность</Link>
        <Link to="/refund" className="text-muted-foreground hover:text-primary">Возврат</Link>
      </nav>
      <h1 className="font-display text-2xl md:text-3xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{subtitle}</p>
      <div className="mt-8 space-y-3 leading-relaxed">
        {rest.map((p, i) =>
          isHeading(p) ? (
            <h2 key={i} className="pt-4 font-display text-lg">{p}</h2>
          ) : (
            <p key={i} className="text-sm md:text-base">{p}</p>
          ),
        )}
      </div>
    </main>
  );
}

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground ${className}`}>
      <Link to="/terms" className="hover:text-primary underline-offset-2 hover:underline">Оферта</Link>
      <Link to="/privacy" className="hover:text-primary underline-offset-2 hover:underline">Конфиденциальность</Link>
      <Link to="/refund" className="hover:text-primary underline-offset-2 hover:underline">Возврат средств</Link>
    </div>
  );
}
