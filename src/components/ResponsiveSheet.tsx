import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ResponsiveSheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  progress?: React.ReactNode;
  desktopMaxWidthClass?: string;
}

export default function ResponsiveSheet({
  title,
  onClose,
  children,
  footer,
  progress,
  desktopMaxWidthClass = "sm:max-w-4xl",
}: ResponsiveSheetProps) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-paper sm:bg-ink/40 sm:backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full h-[100dvh] bg-paper flex flex-col sm:h-auto sm:max-h-[90vh] sm:rounded-card sm:shadow-soft ${desktopMaxWidthClass}`}
      >
        <div className="shrink-0 border-b border-ink/5 bg-paper px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-5 sm:py-5 sm:rounded-t-card sticky top-0 z-10">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display font-bold text-base sm:text-lg min-w-0 truncate">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-ink/5 hover:bg-ink/10 text-ink/50 hover:text-ink/80 flex items-center justify-center shrink-0 pressable"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {progress && <div className="mt-4">{progress}</div>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-24 sm:px-5 sm:py-5 sm:pb-5">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-ink/5 bg-paper px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4 sm:rounded-b-card">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
