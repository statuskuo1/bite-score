import { useEffect, useState, useCallback } from "react";
import { useLang } from "../contexts/LangContext.jsx";
import { getQuestMetrics } from "../utils/questMetrics.js";
import { QuestSheetBody } from "./QuestsPaletteSection.jsx";

/**
 * Full-screen bottom sheet (mobile) or centered card (desktop ≥768px).
 * Sheet uses transform translateY / scale+opacity — not display:none.
 */
export function CuisineQuestModal({ open, onClose, entries, questL, toggleQ, onOpenSuggest }) {
  const { t } = useLang();
  const [mounted, setMounted] = useState(false);
  const [sheetEntered, setSheetEntered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const metrics = getQuestMetrics(entries, questL);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const fn = () => setIsDesktop(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setSheetEntered(false);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setSheetEntered(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setSheetEntered(false);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape" && open) onClose();
    },
    [open, onClose]
  );

  useEffect(() => {
    if (!mounted) return;
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onKeyDown]);

  const handleSheetTransitionEnd = useCallback(
    (e) => {
      if (e.target !== e.currentTarget) return;
      if (sheetEntered || open) return;
      setMounted(false);
    },
    [sheetEntered, open]
  );

  const close = () => onClose();

  const handleSuggest = () => {
    onClose();
    onOpenSuggest?.();
  };

  if (!mounted) return null;

  const backdropOpacity = sheetEntered ? 0.45 : 0;
  const desktop = isDesktop;

  const sheetStyle = desktop
    ? {
        position: "fixed",
        left: "50%",
        top: "50%",
        width: "min(560px, calc(100vw - 32px))",
        maxHeight: "min(90vh, 880px)",
        background: "#141413",
        borderRadius: 16,
        border: "0.5px solid rgba(255,255,255,0.12)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        zIndex: 201,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transform: sheetEntered ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -46%) scale(0.96)",
        opacity: sheetEntered ? 1 : 0,
        transition: "transform 0.25s ease-out, opacity 0.25s ease-out",
      }
    : {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
        maxHeight: "100%",
        background: "#141413",
        borderRadius: "16px 16px 0 0",
        borderTop: "0.5px solid rgba(255,255,255,0.12)",
        zIndex: 201,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transform: sheetEntered ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.25s ease-out",
      };

  const pillCuisines = t.questPillCuisines
    .replace("{done}", String(metrics.doneCount))
    .replace("{total}", String(metrics.totalCuisines));
  const pillLetters = t.questPillLetters.replace("{n}", String(metrics.letterQuestSize));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 199,
          background: `rgba(0,0,0,${backdropOpacity})`,
          transition: "background 0.25s ease-out",
        }}
      />
      <div style={sheetStyle} onTransitionEnd={handleSheetTransitionEnd}>
        <button
          type="button"
          onClick={close}
          style={{
            width: "100%",
            padding: "10px 0 6px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            flexShrink: 0,
          }}
          aria-label={t.closeQuestSheet}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "#3A3A38",
              margin: "0 auto",
            }}
          />
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px 12px",
            flexShrink: 0,
            borderBottom: "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 600, color: "#F1EFE8" }}>{t.cuisineQuestsSection}</span>
          <button
            type="button"
            onClick={close}
            style={{
              fontSize: 22,
              lineHeight: 1,
              color: "#888780",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
            }}
            aria-label={t.close}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              background: "#1A2E0A",
              border: "0.5px solid rgba(151,196,89,0.35)",
              borderRadius: 10,
              padding: "10px 12px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "#97C459", fontWeight: 600 }}>{pillCuisines}</span>
          </div>
          <div
            style={{
              flex: 1,
              background: "#1A2E0A",
              border: "0.5px solid rgba(151,196,89,0.35)",
              borderRadius: 10,
              padding: "10px 12px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "#97C459", fontWeight: 600 }}>{pillLetters}</span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "0 16px 24px",
          }}
        >
          <QuestSheetBody entries={entries} questL={questL} toggleQ={toggleQ} onSuggestClick={handleSuggest} />
        </div>
      </div>
    </div>
  );
}
