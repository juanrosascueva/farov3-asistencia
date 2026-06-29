import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
}

export default function Modal({ title, onClose, children, panelClassName }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const modalContent = (
    <div
      className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-0 sm:px-3 sm:p-6 animate-overlay-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`bg-paper w-full mx-auto sm:mx-0 sm:w-full sm:max-w-md rounded-t-[28px] rounded-b-none sm:rounded-card max-h-[calc(100vh-0.75rem-env(safe-area-inset-bottom))] sm:max-h-[90vh] overflow-y-auto animate-modal-in mt-auto sm:my-auto ${panelClassName || ""}`}
      >
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-ink/5 sticky top-0 bg-paper rounded-t-[28px] sm:rounded-t-card z-10">
          <h3 className="font-display font-bold text-base sm:text-lg min-w-0 truncate">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-ink/5 hover:bg-ink/10 text-ink/50 hover:text-ink/80 flex items-center justify-center pressable"
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
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
