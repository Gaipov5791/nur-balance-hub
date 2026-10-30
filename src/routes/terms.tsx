import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Публичная оферта — Nur Balance" },
      { name: "description", content: "Условия оказания платных услуг приложения Nur Balance (ИП Ескаринова Аяулым)." },
      { property: "og:title", content: "Публичная оферта — Nur Balance" },
      { property: "og:description", content: "Условия оказания платных услуг приложения Nur Balance (ИП Ескаринова Аяулым)." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage kind="oferta" />,
});
