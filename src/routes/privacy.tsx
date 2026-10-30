import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Политика конфиденциальности — Nur Balance" },
      { name: "description", content: "Как Nur Balance обрабатывает и защищает персональные данные пользователей." },
      { property: "og:title", content: "Политика конфиденциальности — Nur Balance" },
      { property: "og:description", content: "Как Nur Balance обрабатывает и защищает персональные данные пользователей." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage kind="privacy" />,
});
