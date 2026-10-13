export type WorkshopSession = {
  id: string;
  title: string;
  coach: string;
  trackId: string;
  venue: string;
  start: string;
  end: string;
  minAge: number | null;
  maxAge: number | null;
  capacity: number | null;
  enrolled: number;
  available: number | null;
  eligible: boolean;
};

export type WorkshopPaymentProof = {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  amount: number;
  status: "reported" | "approved" | "rejected";
  isCurrent: boolean;
  notes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type WorkshopEnrollment = {
  sessionIds: string[];
  revision: number;
  extraCount: number;
  amountDue: number;
  paidAmount: number;
  paymentStatus: "not_required" | "pending" | "partial" | "paid" | "reported" | "rejected";
  paymentReference: string;
  latestProof: WorkshopPaymentProof | null;
};

export type WorkshopRegistrationData = {
  event: {
    eventId: string;
    eventName: string;
    date: string;
    includedCount: number;
    extraUnitPrice: number;
    currency: string;
    requiresPaidRegistration: boolean;
  };
  participant: {
    curp: string;
    name: string;
    birthDate: string | null;
    age: number | null;
    academyName: string;
  };
  eligible: boolean;
  eligibilityReason: string | null;
  sessions: WorkshopSession[];
  enrollment: WorkshopEnrollment | null;
};

export type WorkshopRegistrationResponse = { workshops: WorkshopRegistrationData };
