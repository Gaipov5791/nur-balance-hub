import { useRef, useState } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const MIN_LEN = 3;
const MAX_LEN = 2000;

export const FEEDBACK_PROMPT = "Как мы можем сделать приложение лучше? Если есть идеи — напиши!";

/** Menu block: prompt text + "Написать" button that opens the feedback form. */
export function FeedbackMenuCard({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border border-border bg-card p-3 ${className}`}>
      <p className="text-xs leading-snug text-muted-foreground">{FEEDBACK_PROMPT}</p>
      <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => setOpen(true)}>
        <MessageSquarePlus className="size-4" /> Написать
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const clean = message.trim();

  const send = async () => {
    if (sendingRef.current) return;
    if (clean.length < MIN_LEN) {
      toast.error("Напиши хотя бы пару слов");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      const { error } = await supabase
        .from("app_feedback")
        .insert({ message: clean.slice(0, MAX_LEN) });
      if (error) throw error;
      toast.success("Спасибо! Мы читаем каждое сообщение");
      setMessage("");
      onOpenChange(false);
    } catch {
      toast.error("Не удалось отправить. Проверь интернет и попробуй ещё раз");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-base">Написать команде Nur Balance</DialogTitle>
          <DialogDescription>{FEEDBACK_PROMPT}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_LEN}
            className="min-h-32"
            placeholder="Что неудобно, чего не хватает, что понравилось…"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              {message.length}/{MAX_LEN}
            </span>
            <Button type="submit" disabled={sending || clean.length < MIN_LEN}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : null} Отправить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
