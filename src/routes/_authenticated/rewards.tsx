import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old "Достижения" link; the section is now "Нур-Коины". */
export const Route = createFileRoute("/_authenticated/rewards")({
  beforeLoad: () => {
    throw redirect({ to: "/coins", replace: true });
  },
});
