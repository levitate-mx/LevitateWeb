import { Copy, MessageCircle, RotateCcw } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  buildAdminWhatsAppMessageUrl,
  editAdminMessageDraft,
  normalizeAdminWhatsAppPhone,
  resolveAdminMessageDraft,
  type AdminMessageDraft,
} from "./adminMessage";
import "./AdminMessageComposer.css";

export type AdminMessageTemplate = { id: string; label: string; body: string };

type AdminMessageComposerProps = {
  recipientName: string;
  phone: string;
  templates: AdminMessageTemplate[];
  contextKey: string;
  requireCountryPrefix?: boolean;
};

export function AdminMessageComposer(props: AdminMessageComposerProps) {
  return <AdminMessageComposerEditor key={props.contextKey} {...props} />;
}

function AdminMessageComposerEditor({ recipientName, phone, templates, requireCountryPrefix = false }: AdminMessageComposerProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, AdminMessageDraft>>({});
  const [feedback, setFeedback] = useState("");
  const [isCopying, setIsCopying] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintId = useId();
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const templateId = selectedTemplate?.id ?? "";
  const { message, requiresReview } = resolveAdminMessageDraft(drafts[templateId], selectedTemplate?.body ?? "");
  const normalizedPhone = normalizeAdminWhatsAppPhone(phone, { requireCountryPrefix });
  const whatsappUrl = buildAdminWhatsAppMessageUrl(phone, message, { requireCountryPrefix });
  const isCountryPrefixMissing = requireCountryPrefix && Boolean(phone.trim()) && !/^(?:\+|00)/.test(phone.trim());

  const handleCopy = async () => {
    if (!message.trim() || isCopying || requiresReview) return;
    setIsCopying(true);
    setFeedback("");
    try {
      await navigator.clipboard.writeText(message);
      setFeedback("Mensaje copiado. Puedes pegarlo donde quieras compartirlo.");
    } catch {
      textareaRef.current?.focus();
      textareaRef.current?.select();
      setFeedback("El navegador no permitió copiar. El texto quedó seleccionado: cópialo con el menú del dispositivo o con Ctrl+C / ⌘C.");
    } finally {
      setIsCopying(false);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!whatsappUrl || requiresReview) return;
    const pendingWindow = window.open("about:blank", "_blank");
    if (!pendingWindow) {
      setFeedback("El navegador bloqueó la ventana. Permite las ventanas emergentes o copia el mensaje para abrir WhatsApp manualmente.");
      return;
    }
    try {
      pendingWindow.opener = null;
      pendingWindow.location.replace(whatsappUrl);
      setFeedback("Se abrió WhatsApp; completa el envío allí.");
    } catch {
      pendingWindow.close();
      setFeedback("No se pudo abrir WhatsApp. Puedes copiar el mensaje y abrirlo manualmente.");
    }
  };

  return (
    <section className="registration-admin-message-composer" aria-label="Preparar mensaje">
      <header className="registration-admin-message-composer__header">
        <h3>Preparar mensaje</h3>
        <p>Revisa el texto antes de compartirlo.</p>
      </header>
      <dl className="registration-admin-message-composer__recipient">
        <div><dt>Destinatario</dt><dd>{recipientName.trim() || "Nombre no registrado"}</dd></div>
        <div><dt>Teléfono</dt><dd>{phone.trim() || "Sin teléfono registrado"}</dd></div>
      </dl>
      {!normalizedPhone ? (
        <p className="registration-admin-message-composer__hint">
          {isCountryPrefixMissing
            ? "El teléfono no incluye un código de país válido. Puedes copiar el mensaje y compartirlo por otro medio."
            : "No hay un teléfono válido para abrir WhatsApp. Puedes copiar el mensaje y compartirlo por otro medio."}
        </p>
      ) : null}
      <label>
        Plantilla
        <select
          disabled={!selectedTemplate}
          onChange={(event) => { setSelectedTemplateId(event.target.value); setFeedback(""); }}
          value={templateId}
        >
          {!templates.length ? <option value="">Sin plantillas disponibles</option> : null}
          {templates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
        </select>
      </label>
      <label>
        Mensaje
        <textarea
          aria-describedby={requiresReview ? `${hintId} ${hintId}-updated` : hintId}
          disabled={!selectedTemplate}
          onChange={(event) => {
            const value = event.target.value;
            setDrafts((current) => ({
              ...current,
              [templateId]: editAdminMessageDraft(current[templateId], value, selectedTemplate?.body ?? ""),
            }));
            setFeedback("");
          }}
          ref={textareaRef}
          rows={9}
          value={message}
        />
      </label>
      <p className="registration-admin-message-composer__hint" id={hintId}>
        Puedes cambiar de plantilla sin perder tus ediciones mientras este panel siga abierto. Restaurar reemplaza el texto de la plantilla actual.
      </p>
      {requiresReview ? (
        <div className="registration-admin-message-composer__review">
          <p id={`${hintId}-updated`} role="status">Los datos de este registro cambiaron. Revisa el mensaje antes de compartirlo.</p>
          <button
            onClick={() => {
              if (!selectedTemplate) return;
              setDrafts((current) => ({ ...current, [templateId]: { body: message, sourceBody: selectedTemplate.body } }));
              setFeedback("Revisión confirmada. Ya puedes compartir el texto.");
            }}
            type="button"
          >Ya revisé el texto</button>
        </div>
      ) : null}
      <button
        className="registration-admin-message-composer__restore"
        disabled={!selectedTemplate || (!requiresReview && message === selectedTemplate.body)}
        onClick={() => {
          if (!selectedTemplate) return;
          setDrafts((current) => ({ ...current, [templateId]: { body: selectedTemplate.body, sourceBody: selectedTemplate.body } }));
          setFeedback("Se restauró el texto de la plantilla actual.");
        }}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={15} /> Restaurar plantilla
      </button>
      <div className="registration-admin-message-composer__actions">
        <button disabled={!message.trim() || isCopying || requiresReview} onClick={handleCopy} type="button">
          <Copy aria-hidden="true" size={16} /> {isCopying ? "Copiando..." : "Copiar mensaje"}
        </button>
        <button disabled={!whatsappUrl || requiresReview} onClick={handleOpenWhatsApp} type="button">
          <MessageCircle aria-hidden="true" size={16} /> Abrir WhatsApp
        </button>
      </div>
      {feedback && !requiresReview ? <p className="registration-admin-message-composer__feedback" role="status">{feedback}</p> : null}
    </section>
  );
}
