type AdminWhatsAppPhoneOptions = { requireCountryPrefix?: boolean };

export type AdminMessageDraft = { body: string; sourceBody: string };

export function editAdminMessageDraft(draft: AdminMessageDraft | undefined, body: string, sourceBody: string): AdminMessageDraft {
  return { body, sourceBody: draft?.sourceBody ?? sourceBody };
}

export function resolveAdminMessageDraft(draft: AdminMessageDraft | undefined, sourceBody: string) {
  return {
    message: draft?.body ?? sourceBody,
    requiresReview: Boolean(draft && draft.sourceBody !== sourceBody),
  };
}

export function normalizeAdminWhatsAppPhone(phone: string, options: AdminWhatsAppPhoneOptions = {}): string | null {
  const value = phone.trim();
  if (!value || !/^\+?[\d\s().-]+$/.test(value)) return null;
  if (options.requireCountryPrefix && !/^(?:\+|00)/.test(value)) return null;

  let digits = value.replace(/[\s().-]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);

  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function buildAdminWhatsAppMessageUrl(phone: string, message: string, options: AdminWhatsAppPhoneOptions = {}): string | null {
  const normalizedPhone = normalizeAdminWhatsAppPhone(phone, options);
  if (!normalizedPhone || !message.trim()) return null;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
