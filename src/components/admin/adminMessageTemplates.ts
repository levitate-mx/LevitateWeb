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
  const greeting = "Hola, te escribe el equipo de Levitate MX.";

  if (context.status === "paid") {
    const templates = [{ id: "payment-approved", label: "Pago aprobado", body: context.approvalBody }];
    if (context.ticketDeliveryUrl && context.ticketLabels.length > 0) {
      templates.push({
        id: "tickets-ready",
        label: "Compartir boletos disponibles",
        body: [greeting, "", "Puedes consultar y descargar tus boletos aquí:", context.ticketDeliveryUrl,
          "", ...details, "", "Accesos de esta orden:", ...context.ticketLabels.map((label) => `• ${label}`), "",
          "Cada QR es de un solo uso. Para Day pass y Full pass, recibirás un brazalete en el evento.",
          "Si ya utilizaste un QR, descargarlo nuevamente no lo reactiva.",
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
        ? "Recibimos el comprobante de tu orden. Nuestro equipo aún tiene pendiente revisarlo."
        : "Tu orden aparece pendiente de revisión por nuestro equipo.",
      "", ...details, "", "Te avisaremos cuando termine la revisión.",
      ].join("\n"),
    }];
  }

  if (context.status !== "pending_payment") return [];
  return [{
    id: "proof-reminder",
    label: "Solicitar comprobante",
    body: [greeting, "", "Tu orden aún no tiene un comprobante cargado. Si ya realizaste el pago, compártenos el comprobante para que podamos revisarlo.",
      "", ...details,
      ...(context.correctionUrl ? ["", "Puedes cargar el comprobante aquí:", context.correctionUrl] : []),
      "", "Si necesitas aclarar algún dato de la orden, responde a este mensaje.",
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
    if (order.status === "payment_reported") reviewing.push(`${label}: nuestro equipo tiene pendiente revisar el pago.`);
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
      `Hola${context.contactName ? `, ${context.contactName}` : ""}. Te escribe el equipo de Levitate MX.`,
      "", `Este es el resumen actual de ${context.academyName}:`,
      ...(required.length ? ["", "Para completar:", ...required.map((line) => `• ${line}`)] : []),
      ...(reviewing.length ? ["", "En revisión por nuestro equipo:", ...reviewing.map((line) => `• ${line}`)] : []),
      "", "Puedes consultar los registros ingresando a tu cuenta:", context.portalUrl,
      "", "Si ya resolviste alguno de estos puntos, compártenos la actualización para revisarla.",
    ].join("\n"),
  }];
}
