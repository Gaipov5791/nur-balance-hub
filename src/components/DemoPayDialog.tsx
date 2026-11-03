import { LegalLinks } from "@/components/LegalPage";
import { useState } from "react";
import { PaymentBadges } from "@/components/PaymentBadges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  priceLabel: string;
  onPay: () => Promise<void>;
};


export function DemoPayDialog({ open, onOpenChange, title, description, priceLabel, onPay }: Props) {
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      await onPay();
      onOpenChange(false);
    } catch {
      // The caller already showed a toast; keep the window open for a retry.
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm">Оплата банковской картой</p>
          <PaymentBadges className="mt-3" />
        </div>
        <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
          После нажатия «Оплатить» откроется защищённая страница Freedom Pay: введи данные карты и подтверди платёж кодом 3-D Secure. Данные карты не хранятся в Nur Balance.
        </p>
        <DialogFooter>
          <Button className="w-full" onClick={pay} disabled={busy}>
            {busy ? "Переходим к оплате…" : `Оплатить ${priceLabel}`}
          </Button>
        </DialogFooter>
        <p className="text-center text-xs text-muted-foreground">
          Нажимая «Оплатить», ты принимаешь условия оферты и правила возврата.
        </p>
        <LegalLinks />
      </DialogContent>
    </Dialog>
  );
}
