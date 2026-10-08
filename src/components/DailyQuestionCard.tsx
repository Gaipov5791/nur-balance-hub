import { Link } from "@tanstack/react-router";
import { MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BANK_LABEL, useDailyQuestion } from "@/lib/daily-question";

export function DailyQuestionCard({ compact = false }: { compact?: boolean }) {
  const { question, isLoading, isError } = useDailyQuestion();
  if (isError) return null;
  return (
    <section className={`surface ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <MessageCircleQuestion className="size-4 shrink-0" />
        {question ? BANK_LABEL[question.bank] : "Вопрос дня"}
        {question?.topic ? <span className="truncate font-normal normal-case text-muted-foreground">· {question.topic}</span> : null}
      </div>
      <p className={`mt-2 break-words font-display ${compact ? "text-base" : "text-lg"} leading-snug`}>
        {isLoading ? "Подбираем вопрос…" : question?.text ?? "Как прошёл твой день?"}
      </p>
      {compact ? (
        <p className="mt-1 text-xs text-muted-foreground">Можно ответить на него в записи или рассказать о своём.</p>
      ) : (
        <Button asChild className="mt-4">
          <Link to="/journal">Ответить в дневнике</Link>
        </Button>
      )}
    </section>
  );
}
