import { useState } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Menu block «Написать»: collects improvement ideas; admins get a bell notification. */
export function FeedbackButton({ variant = "card" }: { variant?: "card" | "icon" }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const message = text.trim();
    if (sending || message.length < 3 || !user) return;
    setSending(true);
    const { error } = await supabase.from("app_feedback").insert({ user_id: user.id, message: message.slice(0, 2000) });
    setSending(false);
    if (error) {
      toast.error("Не удалось отправить. Попробуй ещё раз");
      return;
    }
    toast.success("Спасибо! Мы прочитаем каждое сообщение 💚");
    setText("");
    setOpen(false);
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Написать идею"
          title="Есть идея? Напиши нам"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card transition-shadow hover:shadow-soft"
        >
          <MessageSquarePlus className="size-[18px]" />
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            Как мы можем сделать приложение лучше? Если есть идеи — напиши!
          </p>
          <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => setOpen(true)}>
            <MessageSquarePlus className="size-4" /> Написать
          </Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Твоя идея для Nur Balance</DialogTitle>
            <DialogDescription>Что улучшить, чего не хватает, что мешает? Сообщение получит команда приложения.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder="Например: хочу напоминание об отметке настроения вечером"
            className="min-h-32"
          />
          <Button onClick={send} disabled={sending || text.trim().length < 3}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : null} Отправить
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
