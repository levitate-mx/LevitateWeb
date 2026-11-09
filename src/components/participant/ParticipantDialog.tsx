import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";

export function ParticipantDialog({
  title,
  children,
  onClose,
  className = "",
  onKeyDown,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLDialogElement>) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`participant-dialog ${className}`}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div className="participant-dialog__surface">
        <header className="participant-dialog__header">
          <h2 id={headingId}>{title}</h2>
          <button
            className="participant-icon-button"
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            autoFocus
          >
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
