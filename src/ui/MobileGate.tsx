import { useState } from "react";
import { Check, ExternalLink, Monitor, Share2 } from "lucide-react";
import { setLang, t, useLang } from "../i18n";
import { APP_NAME, AUTHOR, AUTHOR_URL, REPO_URL, TAGLINE } from "./brand";
import { CubeLogo } from "./Logo";

/**
 * Phones and very small windows: the modeller needs a mouse, a keyboard and room for its panels.
 * Show a short intro instead and only load the real app (and its CAD kernel) on request.
 */
export function isSmallScreen() {
  return window.innerWidth < 900 || window.innerHeight < 520;
}

export function MobileGate({ onContinue }: { onContinue: () => void }) {
  const lang = useLang((s) => s.lang);
  const [copied, setCopied] = useState(false);
  const url = window.location.href;
  // the share sheet exists on phones; elsewhere the link is copied
  const canShare = "share" in navigator;

  const share = async () => {
    try {
      if (canShare) {
        await navigator.share({ title: APP_NAME, text: t(TAGLINE), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="mobile-gate">
      <div className="flex justify-end">
        <div className="seg" title={t("Language")}>
          {(["en", "de"] as const).map((l) => (
            <button key={l} className={l === lang ? "on" : ""} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-6">
        <span className="cube-hover">
          <CubeLogo size={104} autoPlay={4200} />
        </span>
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight text-white leading-tight">{APP_NAME}</h1>
          <a className="text-[14px] text-ink-400" href={AUTHOR_URL} target="_blank" rel="noreferrer">
            by {AUTHOR}
          </a>
        </div>
        <p className="text-[16px] text-ink-100 leading-snug max-w-[340px]">
          {t(TAGLINE)}
          <br />
          <span className="text-ink-400">{t("As intuitive as Tinkercad, as precise as real CAD.")}</span>
        </p>

        <img className="mobile-gate-preview" src="og.jpg" alt={t("3DPrintModeller on a desktop screen")} />

        <div className="mobile-gate-card">
          <Monitor size={22} className="text-sky-400 shrink-0 mt-0.5" />
          <div className="text-left">
            <div className="text-[15px] font-semibold text-white">{t("Made for the desktop")}</div>
            <div className="text-[13px] text-ink-300 leading-snug mt-1">
              {t("3DPrintModeller is a CAD tool for mouse and keyboard. Open this page on your computer to start modelling.")}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn primary !h-10 !px-4 !text-[14px]" onClick={share}>
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? t("Link copied") : canShare ? t("Share link") : t("Copy link")}
          </button>
          <a className="btn !h-10 !px-4 !text-[14px]" href={REPO_URL} target="_blank" rel="noreferrer">
            {t("Source code")} <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <button className="text-[12.5px] text-ink-500 underline underline-offset-4 py-3" onClick={onContinue}>
        {t("Continue anyway")}
      </button>
    </div>
  );
}
