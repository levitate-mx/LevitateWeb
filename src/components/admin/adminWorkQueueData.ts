export type AdminWorkQueueCategory = "payments" | "music" | "participants";
export type AdminWorkQueueTarget =
  | { type: "order"; id: string }
  | { type: "dance"; id: string }
  | { type: "participant"; id: string };

type QueueOrder = {
  id: string;
  status: string;
  participantName: string;
  buyerName?: string | null;
  academyName: string;
  venue: string;
  reference: string;
  paymentReference?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  proof?: { uploadedAt: string } | null;
};

type QueueDance = {
  id: string;
  title: string;
  academyName?: string;
  venue: string;
  createdAt: string;
  musicUpload?: object | null;
};

type QueueParticipant = {
  id: string;
  fullName: string;
  academyName: string;
  birthDate?: string | null;
  age?: number | null;
  shirtSize?: string | null;
  eventVenues: string[];
  createdAt: string;
};

export type AdminWorkQueueSources = {
  orders: QueueOrder[];
  dances: QueueDance[];
  participants: QueueParticipant[];
};

export type AdminWorkQueueItem = {
  id: string;
  category: AdminWorkQueueCategory;
  title: string;
  subject: string;
  academyName: string;
  venues: string[];
  detail: string;
  dateLabel: string;
  date: string;
  urgent: boolean;
  priority: number;
  actionLabel: string;
  target: AdminWorkQueueTarget;
};

export function getAdminWorkQueueTimestamp(value: string) {
  // D1's timezone-free datetime values are UTC.
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return Date.parse(normalized);
}

export function getAdminWorkQueueAge(value: string, now = Date.now()) {
  const timestamp = getAdminWorkQueueTimestamp(value);
  if (!Number.isFinite(timestamp)) return "Fecha no disponible";
  const hours = Math.max(0, Math.floor((now - timestamp) / 3_600_000));
  if (hours < 1) return "Hace menos de 1 h";
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function buildAdminWorkQueue({ orders, dances, participants }: AdminWorkQueueSources, now = Date.now()): AdminWorkQueueItem[] {
  const items: AdminWorkQueueItem[] = [];
  for (const order of orders) {
    if (!["payment_reported", "rejected", "pending_payment"].includes(order.status)) continue;
    const reported = order.status === "payment_reported";
    const rejected = order.status === "rejected";
    const date = reported
      ? order.proof?.uploadedAt || order.updatedAt || order.createdAt
      : rejected ? order.reviewedAt || order.updatedAt || order.createdAt : order.createdAt;
    const urgent = reported && Boolean(order.proof?.uploadedAt) && now - getAdminWorkQueueTimestamp(order.proof?.uploadedAt || "") >= 48 * 3_600_000;
    const title = reported ? order.proof ? "Comprobante por revisar" : "Pago por revisar sin comprobante" : rejected ? "Pago por corregir" : "Pago pendiente";
    const dateLabel = reported && order.proof?.uploadedAt
      ? "Comprobante recibido"
      : rejected && order.reviewedAt ? "Pago revisado"
      : (reported || rejected) && order.updatedAt ? "Última actualización" : "Orden creada";
    items.push({
      id: `order:${order.id}`, category: "payments", title,
      subject: order.buyerName || order.participantName,
      academyName: order.academyName, venues: [order.venue],
      detail: `${order.paymentReference || order.reference}${!order.proof ? " · Sin comprobante cargado" : ""}`,
      dateLabel, date, urgent, priority: urgent ? 0 : reported ? 1 : rejected ? 2 : 3,
      actionLabel: reported && order.proof ? "Revisar comprobante" : rejected ? "Ver corrección" : "Ver orden",
      target: { type: "order", id: order.id },
    });
  }
  for (const dance of dances) {
    if (dance.musicUpload) continue;
    items.push({
      id: `dance:${dance.id}`, category: "music", title: "Música pendiente", subject: dance.title,
      academyName: dance.academyName || "Sin academia", venues: [dance.venue],
      detail: "La coreografía no tiene un archivo de música cargado.",
      dateLabel: "Coreografía registrada", date: dance.createdAt,
      urgent: false, priority: 3, actionLabel: "Ver coreografía", target: { type: "dance", id: dance.id },
    });
  }
  for (const participant of participants) {
    const missing = [
      !participant.birthDate?.trim() ? "fecha de nacimiento" : "",
      participant.age == null ? "edad" : "",
      !participant.shirtSize?.trim() ? "talla" : "",
    ].filter(Boolean);
    if (missing.length === 0) continue;
    items.push({
      id: `participant:${participant.id}`, category: "participants", title: "Datos incompletos", subject: participant.fullName,
      academyName: participant.academyName, venues: participant.eventVenues,
      detail: `Falta: ${missing.join(", ")}.`,
      dateLabel: "Participante registrado", date: participant.createdAt,
      urgent: false, priority: 3, actionLabel: "Ver participante", target: { type: "participant", id: participant.id },
    });
  }
  return items.sort((left, right) => {
    const leftDate = getAdminWorkQueueTimestamp(left.date);
    const rightDate = getAdminWorkQueueTimestamp(right.date);
    return left.priority - right.priority ||
      (Number.isFinite(leftDate) ? leftDate : Infinity) - (Number.isFinite(rightDate) ? rightDate : Infinity) ||
      left.id.localeCompare(right.id);
  });
}
