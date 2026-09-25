type MessageTemplate = { id: string; label: string; body: string };

type OrderMessageContext = {
  status: string;
  participantName: string;
  academyName: string;
  reference: string;
  venueLabel: string;
  amountLabel: string;
  hasProof: boolean;
  correctionUrl: string;
  approvalBody: string;
  rejectionBody: string;
  ticketDeliveryUrl: string;
  ticketLabels: string[];
};

export function buildOrderMessageTemplates(context: OrderMessageContext): MessageTemplate[] {
  const details = [
    `Participante: ${context.participantName}`,
    `Academia: ${context.academyName}`,
    `Evento: ${context.venueLabel}`,
    `Orden: ${context.reference}`,
    `Total de la orden: ${context.amountLabel}`,
  ];
  const greeting = "¡Hola! Somos el equipo de Levitate MX 💗";

  if (context.status === "paid") {
    const templates = [{ id: "payment-approved", label: "Pago aprobado", body: context.approvalBody }];
    if (context.ticketDeliveryUrl && context.ticketLabels.length > 0) {
      templates.push({
        id: "tickets-ready",
        label: "Compartir boletos disponibles",
        body: [greeting, "", "Tus boletos ya están disponibles. Te compartimos el enlace para consultarlos y descargarlos:", context.ticketDeliveryUrl,
          "", ...details, "", "Accesos de esta orden:", ...context.ticketLabels.map((label) => `• ${label}`), "",
          "Cada QR es de un solo uso. Para Day pass y Full pass, recibirás un brazalete en el evento.",
          "Si ya utilizaste un QR, descargarlo nuevamente no lo reactiva.",
          "", "Si necesitas ayuda para descargar tus boletos, escríbenos. ¡Con gusto te ayudamos!",
        ].join("\n"),
      });
    }
    return templates;
  }

  if (context.status === "rejected") {
    return [{ id: "payment-correction", label: "Corrección solicitada", body: context.rejectionBody }];
  }

  if (context.status === "payment_reported" || context.hasProof) {
    return [{
      id: "payment-in-review",
      label: "Pago pendiente de revisión",
      body: [greeting, "", context.hasProof
        ? "Recibimos el comprobante de tu orden, ¡gracias por enviarlo! Nuestro equipo tiene pendiente revisarlo."
        : "¡Gracias por avisarnos de tu pago! Tu orden está pendiente de revisión por nuestro equipo.",
      "", ...details, "", "Te avisaremos cuando terminemos la revisión. Si tienes alguna duda mientras tanto, estamos por aquí.",
      ].join("\n"),
    }];
  }

  if (context.status !== "pending_payment") return [];
  return [{
    id: "proof-reminder",
    label: "Solicitar comprobante",
    body: [greeting, "", "Aún no vemos un comprobante en tu orden. Si ya realizaste el pago, ¿nos ayudas a compartirlo para revisarlo?",
      "", ...details,
      ...(context.correctionUrl ? ["", "Puedes cargar el comprobante aquí:", context.correctionUrl] : []),
      "", "Si necesitas ayuda para cargarlo o quieres revisar algún dato de tu orden, escríbenos. ¡Con gusto te ayudamos!",
    ].join("\n"),
  }];
}

type AcademyMessageContext = {
  academyName: string;
  contactName: string;
  portalUrl: string;
  orders: Array<{ reference: string; participantName: string; status: string; rejectionMessage?: string | null }>;
  dances: Array<{ title: string; venueLabel: string; hasMusic: boolean }>;
  participants: Array<{ fullName: string; missingFields: string[] }>;
};

export function buildAcademyMessageTemplates(context: AcademyMessageContext): MessageTemplate[] {
  const required: string[] = [];
  const reviewing: string[] = [];
  for (const order of context.orders) {
    const label = `${order.reference} · ${order.participantName}`;
    if (order.status === "pending_payment") required.push(`${label}: completar el pago o cargar el comprobante si ya se realizó.`);
    if (order.status === "rejected") required.push(`${label}: ${order.rejectionMessage || "revisar la corrección solicitada en la orden."}`);
    if (order.status === "payment_reported") reviewing.push(`${label}: pago pendiente de revisión.`);
  }
  for (const dance of context.dances) {
    if (!dance.hasMusic) required.push(`${dance.title} · ${dance.venueLabel}: cargar la música.`);
  }
  for (const participant of context.participants) {
    if (participant.missingFields.length) required.push(`${participant.fullName}: completar ${participant.missingFields.join(", ")}.`);
  }
  if (!required.length && !reviewing.length) return [];
  return [{
    id: "academy-pending",
    label: "Resumen de pendientes de la academia",
    body: [
      `¡Hola${context.contactName.trim() ? `, ${context.contactName.trim()}` : ""}! Somos el equipo de Levitate MX 💗`,
      "", `Te compartimos cómo van los registros de ${context.academyName}.`,
      ...(required.length ? ["", "¿Nos ayudas a completar estos puntos?", ...required.map((line) => `• ${line}`)] : []),
      ...(reviewing.length ? ["", "En revisión por nuestro equipo:", ...reviewing.map((line) => `• ${line}`)] : []),
      "", "Puedes entrar a tu cuenta desde aquí:", context.portalUrl,
      "", required.length
        ? "Si ya completaste alguno de estos puntos, avísanos para revisarlo. ¡Gracias por tu apoyo!"
        : "Por ahora no necesitas hacer nada más con estos pagos. Gracias por tu paciencia.",
      "", "Si tienes alguna duda, escríbenos. Con gusto te ayudamos.",
    ].join("\n"),
  }];
}
