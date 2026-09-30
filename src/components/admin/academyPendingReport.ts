export type PendingCategory =
  "music" | "registrations" | "tickets" | "details" | "review" | "extras";
export const pendingCategories: Array<{
  id: PendingCategory;
  label: string;
  description: string;
}> = [
  {
    id: "music",
    label: "Música",
    description: "Archivos por cargar para cada coreografía.",
  },
  {
    id: "registrations",
    label: "Pagos de inscripciones",
    description: "Órdenes, comprobantes y registros por completar.",
  },
  {
    id: "tickets",
    label: "Boletos",
    description: "Confirmados y faltantes por participante y evento.",
  },
  {
    id: "details",
    label: "Datos y coreografías",
    description: "Información pendiente de la academia y sus registros.",
  },
  {
    id: "review",
    label: "En revisión por Levitate",
    description: "Nuestro equipo debe validar estos pagos. No volver a pagar.",
  },
  {
    id: "extras",
    label: "Compras adicionales",
    description:
      "Foto, video y otras compras; no son requisitos de participación.",
  },
];

type ReportPerson = {
  id: string;
  academyId: string;
  fullName: string;
  curp: string;
  birthDate?: string | null;
  age?: number | null;
  shirtSize?: string | null;
};
type ReportDance = {
  id: string;
  academyId: string;
  title: string;
  venue: string;
  venueLabel: string;
  categoryLabel: string;
  isReleve: boolean;
  hasMusic: boolean;
  participantIds: string[];
  choreographerCount: number;
};
type ReportOrder = {
  id: string;
  academyId?: string | null;
  curp: string;
  participantName: string;
  venue: string;
  venueLabel: string;
  reference: string;
  status: string;
  kind: "registration" | "shop";
  amount: number;
  paidAmount: number;
  currency: string;
  hasProof: boolean;
  rejectionMessage?: string | null;
  ticketCount: number;
  cancelledTicketCount: number;
  danceIds: string[];
  concept: string;
};
export type AcademyPendingSources = {
  academy: {
    id: string;
    name: string;
    contactName: string;
    phone?: string | null;
    email: string;
  };
  participants: ReportPerson[];
  dances: ReportDance[];
  orders: ReportOrder[];
  ticketMinimum: number;
  portalUrl: string;
};
export type AcademyPendingItem = {
  id: string;
  category: PendingCategory;
  subject: string;
  context: string;
  detail: string;
};
export type AcademyPendingReport = {
  academyId: string;
  academyName: string;
  contactName: string;
  portalUrl: string;
  venues: Array<{ id: string; label: string }>;
  scopeLabel: string;
  items: AcademyPendingItem[];
};

const normalizeCurp = (value: string) => value.replace(/\s/g, "").toUpperCase();
const money = (value: number, currency: string) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(value);

function describeOrder(order: ReportOrder) {
  const total = money(order.amount, order.currency);
  if (
    order.status === "payment_reported" ||
    (order.hasProof && order.status === "pending_payment")
  ) {
    return `Orden ${order.reference} · Total ${total}. ${order.hasProof ? "Comprobante recibido" : "Pago reportado"}; pendiente de validación por Levitate. No realizar otro pago por esta orden.`;
  }
  const recorded =
    order.paidAmount > 0
      ? ` Importe registrado: ${money(order.paidAmount, order.currency)}; diferencia contra el total: ${money(Math.max(0, order.amount - order.paidAmount), order.currency)}. Su validación sigue pendiente.`
      : "";
  return `Orden ${order.reference} · Total ${total}.${recorded} ${
    order.status === "rejected"
      ? `Corrección solicitada: ${order.rejectionMessage?.trim() || "revisar el comprobante con administración."}`
      : "Completar el pago o cargar el comprobante si ya se realizó."
  }`;
}

export function buildAcademyPendingReport(
  source: AcademyPendingSources,
  venue = "all",
): AcademyPendingReport {
  // Never associate different academies by display name or by CURP alone.
  const participants = source.participants.filter(
    (person) => person.academyId === source.academy.id,
  );
  const allDances = source.dances.filter(
    (dance) => dance.academyId === source.academy.id,
  );
  const allOrders = source.orders.filter(
    (order) => order.academyId === source.academy.id,
  );
  const venues = Array.from(
    new Map(
      [...allDances, ...allOrders]
        .filter((record) => record.venue)
        .map((record) => [
          record.venue,
          { id: record.venue, label: record.venueLabel },
        ]),
    ).values(),
  );
  const dances = allDances.filter(
    (dance) => venue === "all" || dance.venue === venue,
  );
  // Registration orders can cover more than one event in their line items.
  const orders = allOrders.filter(
    (order) =>
      venue === "all" ||
      order.venue === venue ||
      dances.some((dance) => order.danceIds.includes(dance.id)),
  );
  const items: AcademyPendingItem[] = [];
  const add = (
    id: string,
    category: PendingCategory,
    subject: string,
    context: string,
    detail: string,
  ) => items.push({ id, category, subject, context, detail });
  const danceContext = (dance: ReportDance) =>
    [dance.venueLabel, dance.categoryLabel].filter(Boolean).join(" · ");
  const isReview = (order: ReportOrder) =>
    order.status === "payment_reported" ||
    (order.status === "pending_payment" && order.hasProof);

  for (const dance of dances) {
    if (!dance.hasMusic)
      add(
        `music:${dance.id}`,
        "music",
        dance.title,
        danceContext(dance),
        "Cargar el archivo de música MP3 desde el portal de la academia.",
      );
    if (!dance.isReleve && dance.participantIds.length === 0)
      add(
        `cast:${dance.id}`,
        "details",
        dance.title,
        danceContext(dance),
        "Agregar los participantes de esta coreografía.",
      );
    if (dance.choreographerCount === 0)
      add(
        `teacher:${dance.id}`,
        "details",
        dance.title,
        danceContext(dance),
        "Vincular al coreógrafo o maestro responsable.",
      );
    if (
      dance.isReleve &&
      !orders.some(
        (order) =>
          order.kind === "registration" &&
          (order.curp === `RELEVE:${dance.id}` ||
            order.danceIds.includes(dance.id)),
      )
    ) {
      add(
        `releve:${dance.id}`,
        "registrations",
        dance.title,
        danceContext(dance),
        "No hay una orden de inscripción Relevé vinculada. Consultar el pago desde el portal de la academia.",
      );
    }
  }

  for (const person of participants) {
    const personDances = dances.filter(
      (dance) => !dance.isReleve && dance.participantIds.includes(person.id),
    );
    if (venue !== "all" && !personDances.length) continue;
    const context = personDances
      .map((dance) => `${dance.title} (${dance.venueLabel})`)
      .join("; ");
    const missingFields = [
      !person.birthDate?.trim() ? "fecha de nacimiento" : "",
      person.age == null ? "edad" : "",
      !person.shirtSize?.trim() ? "talla de playera" : "",
    ].filter(Boolean);
    if (missingFields.length)
      add(
        `person:${person.id}`,
        "details",
        person.fullName,
        context,
        `Completar: ${missingFields.join(", ")}.`,
      );
    if (!personDances.length) {
      if (!allDances.some((dance) => dance.participantIds.includes(person.id)))
        add(
          `dance:${person.id}`,
          "details",
          person.fullName,
          "",
          "Vincular a una coreografía si participará en esta edición.",
        );
      continue;
    }
    const personOrders = orders.filter(
      (order) =>
        normalizeCurp(person.curp) &&
        normalizeCurp(order.curp) === normalizeCurp(person.curp),
    );
    const registrationOrders = personOrders.filter(
      (order) => order.kind === "registration",
    );
    const uncovered = personDances.filter(
      (dance) =>
        !registrationOrders.some((order) => order.danceIds.includes(dance.id)),
    );
    if (uncovered.length)
      add(
        `registration:${person.id}`,
        "registrations",
        person.fullName,
        uncovered
          .map((dance) => `${dance.title} (${dance.venueLabel})`)
          .join("; "),
        registrationOrders.some((order) => !order.danceIds.length)
          ? "La orden existente no detalla estas coreografías. Solicitar a Levitate que confirme la cobertura antes de realizar otro pago."
          : "No hay una orden de inscripción vinculada a estas coreografías. Consultar el importe actualizado en el portal de inscripciones.",
      );

    for (const event of new Set(personDances.map((dance) => dance.venue))) {
      const ticketOrders = personOrders.filter(
        (order) =>
          order.kind === "shop" &&
          order.venue === event &&
          order.ticketCount > 0,
      );
      const confirmed = ticketOrders.reduce(
        (sum, order) =>
          sum +
          (order.status === "paid"
            ? Math.max(0, order.ticketCount - order.cancelledTicketCount)
            : 0),
        0,
      );
      const reviewing = ticketOrders.reduce(
        (sum, order) => sum + (isReview(order) ? order.ticketCount : 0),
        0,
      );
      const missing = Math.max(0, source.ticketMinimum - confirmed);
      if (!missing) continue;
      const toComplete = Math.max(0, missing - reviewing);
      const eventDances = personDances.filter((dance) => dance.venue === event);
      add(
        `tickets:${person.id}:${event}`,
        "tickets",
        person.fullName,
        `${eventDances[0].venueLabel} · ${eventDances.map((dance) => dance.title).join(", ")}`,
        `${confirmed} de ${source.ticketMinimum} boletos confirmados; falta${missing === 1 ? "" : "n"} ${missing} por confirmar.` +
          (reviewing
            ? ` ${reviewing} en revisión por Levitate; no volver a pagarlos.`
            : "") +
          (toComplete
            ? ` Completar ${toComplete} boleto${toComplete === 1 ? "" : "s"} o enviar el comprobante si ya se pagaron.`
            : " Esperar la validación de nuestro equipo.") +
          (ticketOrders.some((order) => order.cancelledTicketCount > 0)
            ? " Los boletos cancelados no se cuentan como confirmados."
            : ""),
      );
    }
  }

  for (const order of orders) {
    if (order.status === "paid") continue;
    if (
      !["pending_payment", "payment_reported", "rejected"].includes(
        order.status,
      )
    )
      continue;
    const category: PendingCategory = isReview(order)
      ? "review"
      : order.kind === "registration"
        ? "registrations"
        : order.ticketCount > 0
          ? "tickets"
          : "extras";
    const concept =
      order.kind === "registration"
        ? "Inscripción"
        : order.ticketCount > 0
          ? `${order.ticketCount} boleto(s)`
          : "Compra adicional";
    add(
      `order:${order.kind}:${order.id}`,
      category,
      order.participantName,
      `${order.venueLabel} · ${concept}${order.concept ? ` · ${order.concept}` : ""}`,
      describeOrder(order),
    );
  }

  const missingContact = [
    !source.academy.contactName.trim() ? "nombre del titular" : "",
    !source.academy.phone?.trim() ? "teléfono" : "",
    !source.academy.email.trim() ? "correo" : "",
  ].filter(Boolean);
  if (missingContact.length)
    add(
      "contact",
      "details",
      source.academy.name,
      "Contacto de la academia",
      `Completar: ${missingContact.join(", ")}.`,
    );
  if (venue === "all" && !allDances.length)
    add(
      "no-dances",
      "details",
      source.academy.name,
      "",
      "Registrar las coreografías que participarán.",
    );

  return {
    academyId: source.academy.id,
    academyName: source.academy.name,
    contactName: source.academy.contactName,
    portalUrl: source.portalUrl,
    venues,
    scopeLabel:
      venue === "all"
        ? "Todos los eventos"
        : venues.find((event) => event.id === venue)?.label || venue,
    items,
  };
}

export function buildAcademyPendingMessage(
  report: AcademyPendingReport,
  categories: PendingCategory[],
) {
  const selected = report.items.filter((item) =>
    categories.includes(item.category),
  );
  const hasActions = selected.some((item) => item.category !== "review");
  return [
    `¡Hola${report.contactName.trim() ? `, ${report.contactName.trim()}` : ""}! Somos el equipo de Levitate MX 💗`,
    "",
    `Nos da mucho gusto contar con ${report.academyName}. Te compartimos los pendientes registrados para acompañarles en la preparación de sus coreografías.`,
    `Evento: ${report.scopeLabel}.`,
    ...(hasActions
      ? ["", "¿Nos ayudas a revisarlos con tu equipo y las familias?"]
      : []),
    ...pendingCategories
      .filter((category) => categories.includes(category.id))
      .flatMap((category) => {
        const rows = selected.filter((item) => item.category === category.id);
        return rows.length
          ? [
              "",
              `*${category.label}*`,
              ...rows.map(
                (item) =>
                  `• ${item.subject}${item.context ? ` · ${item.context}` : ""}: ${item.detail}`,
              ),
            ]
          : [];
      }),
    ...(!selected.length
      ? ["", "No encontramos pendientes en las categorías seleccionadas."]
      : []),
    "",
    "Puedes consultar y completar los registros aquí:",
    report.portalUrl,
    "",
    "Si ya resolvieron alguno de estos puntos, avísanos para revisarlo. Los pagos en revisión no necesitan realizarse de nuevo.",
    "",
    "¡Muchas gracias por tu apoyo! Si necesitan ayuda, estamos por aquí. Nos emociona verles en el escenario 💗",
  ].join("\n");
}
