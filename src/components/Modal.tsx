import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import UiIcon from "./UiIcon";

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
      className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 py-6 px-3 sm:p-6 animate-overlay-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`ui-card bg-paper w-full max-w-[calc(100vw-1.5rem)] mx-auto sm:mx-0 sm:w-full sm:max-w-md max-h-[90vh] overflow-y-auto animate-modal-in my-auto ${panelClassName || ""}`}
      >
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-ink/5 sticky top-0 bg-paper rounded-t-card z-10">
          <h3 className="font-display font-bold text-base sm:text-lg min-w-0 truncate">{title}</h3>
          <button
            onClick={onClose}
            className="ui-icon-button bg-ink/5 hover:bg-ink/10 text-ink/50 hover:text-ink/80 pressable"
          >
            <UiIcon name="X" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
