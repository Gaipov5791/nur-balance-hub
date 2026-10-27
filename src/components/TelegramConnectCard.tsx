import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, ExternalLink, Loader2, Send, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramConnectLink, sendTelegramTest } from "@/lib/telegram.functions";

export function TelegramConnectCard({ therapistId }: { therapistId: string }) {
  const qc = useQueryClient();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<"link" | "test" | "unlink" | null>(null);

  const status = useQuery({
    queryKey: ["therapist-telegram", therapistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapist_telegram")
        .select("tg_username, linked_at")
        .eq("therapist_id", therapistId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // While a connect link is open, check every few seconds for the bot confirmation.
    refetchInterval: (q) => (link && !q.state.data ? 4000 : false),
  });

  const connected = !!status.data;

  const createLink = async () => {
    setBusy("link");
    try {
      const r = await getTelegramConnectLink();
      setLink(r.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать ссылку", {
        action: { label: "Повторить", onClick: () => void createLink() },
      });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      await sendTelegramTest();
      toast.success("Тестовое сообщение отправлено в Telegram");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить сообщение");
    } finally {
      setBusy(null);
    }
  };

  const unlink = async () => {
    setBusy("unlink");
    const { error } = await supabase.rpc("unlink_my_telegram");
    setBusy(null);
    if (error) {
      toast.error("Не удалось отключить Telegram");
      return;
    }
    setLink(null);
    await qc.invalidateQueries({ queryKey: ["therapist-telegram", therapistId] });
    toast.success("Уведомления в Telegram отключены");
  };

  return (
    <section className="surface mb-4 p-5">
      <h2 className="flex items-center gap-2 font-display text-base">
        <BellRing className="size-4 text-primary" /> Уведомления в Telegram
      </h2>

      {status.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Проверяем подключение…</p>
      ) : connected ? (
        <>
          <p className="mt-2 text-sm">
            Подключено
            {status.data?.tg_username ? (
              <span className="font-medium"> · @{status.data.tg_username}</span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Сюда приходят новые записи, отмены и напоминания за 24 часа и за 1 час до консультации.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void test()} disabled={!!busy}>
              {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Отправить тест
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void unlink()} disabled={!!busy}>
              <Unlink className="size-4" /> Отключить
            </Button>
          </div>
        </>
      ) : link ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Открой бота и нажми «Старт» (Start). Ссылка действует 30 минут — после этого здесь
            появится «Подключено».
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <a href={link} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Открыть Telegram
              </a>
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Ждём подтверждения от бота
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Получай в Telegram новые записи клиентов и напоминания о консультациях.
          </p>
          <Button className="mt-3" size="sm" onClick={() => void createLink()} disabled={!!busy}>
            {busy === "link" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Подключить Telegram
          </Button>
        </>
      )}
    </section>
  );
}
