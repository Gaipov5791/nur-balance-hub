import { useState } from "react";
import { CreditCard, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  priceLabel: string;
  onPay: () => Promise<void>;
};

const METHODS = [
  { id: "kaspi", label: "Kaspi QR", icon: QrCode },
  { id: "card", label: "Банковская карта", icon: CreditCard },
] as const;

export function DemoPayDialog({ open, onOpenChange, title, description, priceLabel, onPay }: Props) {
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("kaspi");
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      await onPay();
      onOpenChange(false);
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
        <div className="grid grid-cols-2 gap-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm transition",
                method === m.id ? "border-primary bg-primary-soft text-primary" : "border-border",
              )}
            >
              <m.icon className="size-6" />
              {m.label}
            </button>
          ))}
        </div>
        <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
          Демо-режим: деньги не списываются. Настоящая оплата появится после подключения банка.
        </p>
        <DialogFooter>
          <Button className="w-full" onClick={pay} disabled={busy}>
            {busy ? "Оплачиваем…" : `Оплатить ${priceLabel} (демо)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
