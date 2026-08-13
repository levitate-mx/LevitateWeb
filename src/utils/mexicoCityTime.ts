export const MEXICO_CITY_TIME_ZONE = "America/Mexico_City";

type MexicoCityDateParts = {
  day: number;
  hour: number;
  millisecond: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

type MexicoCityDatePartsInput = {
  day: number;
  hour?: number;
  millisecond?: number;
  minute?: number;
  month: number;
  second?: number;
  year: number;
};

const mexicoCityDateTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: MEXICO_CITY_TIME_ZONE,
  year: "numeric",
});

function toValidDate(value: Date | number | string) {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getPartValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return Number(parts.find((part) => part.type === type)?.value ?? 0);
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function getMexicoCityDateTimeParts(value: Date | number | string): MexicoCityDateParts | null {
  const date = toValidDate(value);

  if (!date) {
    return null;
  }

  const parts = mexicoCityDateTimePartsFormatter.formatToParts(date);

  return {
    day: getPartValue(parts, "day"),
    hour: getPartValue(parts, "hour") % 24,
    millisecond: date.getMilliseconds(),
    minute: getPartValue(parts, "minute"),
    month: getPartValue(parts, "month"),
    second: getPartValue(parts, "second"),
    year: getPartValue(parts, "year"),
  };
}

function getMexicoCityOffsetMs(date: Date) {
  const parts = getMexicoCityDateTimeParts(date);

  if (!parts) {
    return 0;
  }

  const formattedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return formattedAsUtc - (date.getTime() - date.getMilliseconds());
}

export function getMexicoCityDateFromParts({
  day,
  hour = 0,
  millisecond = 0,
  minute = 0,
  month,
  second = 0,
  year,
}: MexicoCityDatePartsInput) {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const firstPass = new Date(wallClockAsUtc - getMexicoCityOffsetMs(new Date(wallClockAsUtc)));
  const refinedOffset = getMexicoCityOffsetMs(firstPass);

  return new Date(wallClockAsUtc - refinedOffset);
}

export function getMexicoCityDateKey(value: Date | number | string) {
  const parts = getMexicoCityDateTimeParts(value);

  if (!parts) {
    return "";
  }

  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

export function getMexicoCityStartOfDay(value: Date | number | string) {
  const parts = getMexicoCityDateTimeParts(value);

  if (!parts) {
    return new Date(NaN);
  }

  return getMexicoCityDateFromParts({ day: parts.day, month: parts.month, year: parts.year });
}

export function getMexicoCityEndOfDay(value: Date | number | string) {
  const parts = getMexicoCityDateTimeParts(value);

  if (!parts) {
    return new Date(NaN);
  }

  return getMexicoCityDateFromParts({
    day: parts.day,
    hour: 23,
    millisecond: 999,
    minute: 59,
    month: parts.month,
    second: 59,
    year: parts.year,
  });
}

export function addMexicoCityDays(value: Date | number | string, days: number) {
  const parts = getMexicoCityDateTimeParts(value);

  if (!parts) {
    return new Date(NaN);
  }

  return getMexicoCityDateFromParts({
    ...parts,
    day: parts.day + days,
  });
}

export function parseMexicoCityDateInput(value: string, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = endOfDay
    ? getMexicoCityDateFromParts({ day, hour: 23, millisecond: 999, minute: 59, month, second: 59, year })
    : getMexicoCityDateFromParts({ day, month, year });
  const parts = getMexicoCityDateTimeParts(date);

  if (!parts || parts.year !== year || parts.month !== month || parts.day !== day) {
    return null;
  }

  return date;
}

export function getMexicoCityDateInputValue(value: Date | number | string) {
  return getMexicoCityDateKey(value);
}

export function formatMexicoCityDate(
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
  fallback = "Sin fecha",
) {
  const date = toValidDate(value);

  if (!date) {
    return typeof value === "string" && value ? value : fallback;
  }

  return new Intl.DateTimeFormat("es-MX", { ...options, timeZone: MEXICO_CITY_TIME_ZONE }).format(date);
}

export function formatMexicoCityTime(
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
  fallback = "",
) {
  const date = toValidDate(value);

  if (!date) {
    return typeof value === "string" && value ? value : fallback;
  }

  return new Intl.DateTimeFormat("es-MX", { ...options, timeZone: MEXICO_CITY_TIME_ZONE }).format(date);
}

export function formatMexicoCityDateTime(
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  fallback = "Sin fecha",
) {
  const date = toValidDate(value);

  if (!date) {
    return typeof value === "string" && value ? value : fallback;
  }

  return new Intl.DateTimeFormat("es-MX", { ...options, timeZone: MEXICO_CITY_TIME_ZONE }).format(date);
}
