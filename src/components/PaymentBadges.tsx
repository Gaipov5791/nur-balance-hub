import { Link } from "@tanstack/react-router";
import { Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const SELLER = {
  name: "ИП Ескаринова Аяулым",
  phone: "8 747 400 4918",
  phoneHref: "tel:+77474004918",
  email: "eskarinovaayaulym00@mail.ru",
};

function CardFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-12 items-center justify-center rounded-md border border-border bg-brand-card px-1.5 shadow-sm"
    >
      {children}
    </span>
  );
}

export function VisaLogo() {
  return (
    <CardFrame label="Visa">
      <svg viewBox="0 7.9 24 8.2" className="h-3.5 w-auto fill-brand-visa" aria-hidden="true">
        <path d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z" />
      </svg>
    </CardFrame>
  );
}

export function MastercardLogo() {
  return (
    <CardFrame label="Mastercard">
      <svg viewBox="0 0 32 20" className="h-5 w-auto" aria-hidden="true">
        <circle cx="10" cy="10" r="10" className="fill-brand-mc-red" />
        <circle cx="22" cy="10" r="10" className="fill-brand-mc-yellow" />
        <path d="M16 2a10 10 0 0 1 0 16a10 10 0 0 1 0-16z" className="fill-brand-mc-orange" />
      </svg>
    </CardFrame>
  );
}

/** Visa + Mastercard logos with the 3-D Secure / Freedom Pay note. */
export function PaymentBadges({ className, centered = false }: { className?: string; centered?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", centered && "justify-center", className)}>
      <VisaLogo />
      <MastercardLogo />
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-2 text-[11px] font-medium text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
        3-D Secure · Freedom Pay
      </span>
    </div>
  );
}

/** Customer-facing description of how online payment works (required by the acquirer). */
export function PaymentInfo({ className }: { className?: string }) {
  return (
    <section className={cn("surface p-5", className)} aria-labelledby="payment-info-title">
      <h2 id="payment-info-title" className="flex items-center gap-2 font-display text-base">
        <Lock className="size-4 text-primary" aria-hidden="true" /> Порядок оплаты и безопасность
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        <li>Выбери подписку или пакет Nur-Coins. Все цены указаны в тенге (₸).</li>
        <li>Нажми «Оплатить» — откроется защищённая страница платёжного сервиса Freedom Pay.</li>
        <li>Введи данные карты Visa или Mastercard и подтверди платёж кодом 3-D Secure от своего банка.</li>
        <li>После подтверждения оплаты подписка или монеты активируются автоматически.</li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Данные карты вводятся только на странице Freedom Pay (стандарт PCI DSS) и не передаются и не хранятся в Nur Balance.
        Условия возврата описаны в{" "}
        <Link to="/refund" className="text-primary underline-offset-2 hover:underline">
          правилах возврата средств
        </Link>
        , полные условия — в{" "}
        <Link to="/terms" className="text-primary underline-offset-2 hover:underline">
          публичной оферте
        </Link>
        .
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Продавец: {SELLER.name}. Вопросы по оплате и возврату:{" "}
        <a href={SELLER.phoneHref} className="text-primary underline-offset-2 hover:underline">
          {SELLER.phone}
        </a>
        ,{" "}
        <a href={`mailto:${SELLER.email}`} className="text-primary underline-offset-2 hover:underline">
          {SELLER.email}
        </a>
      </p>
      <PaymentBadges className="mt-4" />
    </section>
  );
}
