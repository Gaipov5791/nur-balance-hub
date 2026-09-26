import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import introVideo from "@/assets/nur-balance-intro.mp4.asset.json";
import introWebm from "@/assets/nur-balance-intro.webm.asset.json";
import introPoster from "@/assets/nur-balance-intro-poster.jpg.asset.json";

const SESSION_KEY = "nur-balance-intro-seen";

export function LaunchIntro() {
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const dismiss = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Private browsing may disallow storage; the app should still open.
    }
    setVisible(false);
  };

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      // Continue with a one-time display when storage is unavailable.
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timeout = window.setTimeout(dismiss, 15000);
    return () => {
      window.clearTimeout(timeout);
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Заставка Nur Balance"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background"
    >
      <video
        ref={videoRef}
        poster={introPoster.url}
        autoPlay
        muted={muted}
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
        className="h-full w-full object-contain"
        aria-label="Анимация логотипа Nur Balance"
      >
        <source src={introWebm.url} type="video/webm" />
        <source src={introVideo.url} type="video/mp4" />
      </video>
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={muted ? "Включить звук" : "Выключить звук"}
          title={muted ? "Включить звук" : "Выключить звук"}
          onClick={() => {
            const nextMuted = !muted;
            if (videoRef.current) videoRef.current.muted = nextMuted;
            setMuted(nextMuted);
          }}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
        <Button type="button" variant="secondary" onClick={dismiss}>
          Пропустить <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}