import { useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import { isReleveHotPresaleActive, releveHotPresaleEndsAt } from "../../utils/releveHotPresale";
import "./ReleveHotPresalePopup.css";

const dismissedKey = "levitate-releve-hot-presale-dismissed-2026";

export function ReleveHotPresalePopup() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isReleveHotPresaleActive()) return;

    try {
      if (window.sessionStorage.getItem(dismissedKey) === "true") return;
    } catch {
      // The promotion remains available when storage is disabled.
    }

    dialog.showModal();
    const expiryTimer = window.setTimeout(() => dialog.close(), releveHotPresaleEndsAt - Date.now());

    return () => {
      window.clearTimeout(expiryTimer);
      if (dialog.open) dialog.close();
    };
  }, []);

  if (!isReleveHotPresaleActive()) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(dismissedKey, "true");
    } catch {
      // Closing the dialog should still work when storage is disabled.
    }
    dialogRef.current?.close();
  };

  return (
    <dialog
      aria-labelledby="releve-hot-presale-title"
      aria-describedby="releve-hot-presale-description"
      className="releve-hot-presale-popup"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      ref={dialogRef}
    >
      <div className="releve-hot-presale-popup__card">
        <button
          aria-label="Cerrar promoción"
          className="releve-hot-presale-popup__close"
          onClick={dismiss}
          type="button"
        >
          <X aria-hidden="true" size={20} />
        </button>
        <div className="releve-hot-presale-popup__photo" aria-hidden="true">
          <img src="/assets/releve-idea-aerial.jpg" alt="" />
          <span>Levitate MX</span>
        </div>

        <div className="releve-hot-presale-popup__content">
          <p className="releve-hot-presale-popup__eyebrow">Hot Presale · Premio Relevé</p>
          <h2 id="releve-hot-presale-title">
            Tu momento de <span>elevarte.</span>
          </h2>
          <p className="releve-hot-presale-popup__description" id="releve-hot-presale-description">
            Inscríbete a Relevé con un <strong>30% de descuento</strong> sobre el precio de preventa.
          </p>

          <div className="releve-hot-presale-popup__offer" aria-label="Precio de promoción: 700 pesos mexicanos">
            <span>Inscripción Relevé</span>
            <div>
              <del>$1,000 MXN</del>
              <strong>$700 <small>MXN</small></strong>
            </div>
          </div>

          <p className="releve-hot-presale-popup__deadline">
            Del 6 al <strong>8 de octubre de 2026 a las 10:00 a. m.</strong> · Hora de CDMX
          </p>

          <div className="releve-hot-presale-popup__actions">
            <a className="releve-hot-presale-popup__primary" href="/registro/academias?seccion=releve">
              Inscribirme a Relevé <ArrowRight aria-hidden="true" size={18} />
            </a>
            <a className="releve-hot-presale-popup__secondary" href="/releve">
              Conoce Relevé
            </a>
          </div>
        </div>
      </div>
    </dialog>
  );
}
