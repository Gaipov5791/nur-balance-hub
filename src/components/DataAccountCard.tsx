import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";

export function DataAccountCard() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");

  const doExport = async () => {
    setExporting(true);
    try {
      const json = await exportMyData();
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `nur-balance-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Архив данных скачан");
    } catch {
      toast.error("Не получилось подготовить архив");
    } finally {
      setExporting(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteMyAccount({ data: { confirm: "УДАЛИТЬ" } });
      await supabase.auth.signOut();
      toast.success("Аккаунт удалён");
      window.location.href = "/auth";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не получилось удалить аккаунт");
      setDeleting(false);
    }
  };

  return (
    <div className="surface p-5">
      <h2 className="font-display text-base">Данные и аккаунт</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Ты можешь скачать все свои записи или навсегда удалить аккаунт.{" "}
        <Link to="/privacy" className="text-primary underline">Политика конфиденциальности</Link>
      </p>
      <div className="mt-4 grid gap-2">
        <Button variant="secondary" disabled={exporting} onClick={() => void doExport()}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Скачать мои данные
        </Button>
        <AlertDialog onOpenChange={() => setConfirm("")}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="text-destructive">
              <Trash2 className="size-4" /> Удалить аккаунт
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить аккаунт навсегда?</AlertDialogTitle>
              <AlertDialogDescription>
                Будут удалены дневник, видео и аудио, отметки настроения, анализы, монеты и подписка. Вернуть их будет нельзя.
                Чтобы подтвердить, напиши слово УДАЛИТЬ.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="УДАЛИТЬ" />
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={confirm.trim() !== "УДАЛИТЬ" || deleting}
                onClick={() => void doDelete()}
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : null} Удалить
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
