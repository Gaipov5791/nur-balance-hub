import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Правила возврата средств — Nur Balance" },
      { name: "description", content: "Порядок и условия возврата денег за подписку и Нур-Коины в Nur Balance." },
      { property: "og:title", content: "Правила возврата средств — Nur Balance" },
      { property: "og:description", content: "Порядок и условия возврата денег за подписку и Нур-Коины в Nur Balance." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage kind="refund" />,
});
