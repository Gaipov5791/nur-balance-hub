import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "nur-install-dismissed";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return true;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Gentle hint that the app can live on the phone's home screen. */
export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if (isIos()) {
      setIos(true);
      setVisible(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    close();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 md:inset-x-auto md:right-6 md:bottom-6 md:max-w-sm">
      <div className="surface flex items-start gap-3 bg-card/95 p-4 backdrop-blur-xl">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary-soft">
          <Smartphone className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Держите Nur Balance под рукой</p>
          {ios && !deferred ? (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              Нажмите <Share className="inline size-4" /> «Поделиться» и выберите «На экран „Домой“».
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Добавьте приложение на экран телефона — открывается одним касанием.
            </p>
          )}
          {deferred ? (
            <Button size="sm" className="mt-3" onClick={() => void install()}>
              Установить
            </Button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть подсказку"
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
