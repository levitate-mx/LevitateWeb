import type { ChangeEvent, FormEvent } from "react";
import {
  ArrowRight,
  Camera,
  CalendarDays,
  CreditCard,
  FileCheck2,
  Info,
  Mail,
  Minus,
  PackageCheck,
  Phone,
  Plus,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Ticket,
  Trash2,
  UploadCloud,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type TicketOption = {
  id: string;
  label: string;
  detail: string;
};

type TicketProduct = {
  id: "block" | "day" | "full";
  name: string;
  description: string;
  price: number;
  priceNote?: string;
  regularPrice?: number;
  selectionLabel?: string;
  options?: TicketOption[];
};

type MediaProduct = {
  description: string;
  id: "solo" | "duo" | "trio" | "group";
  name: string;
  price: number;
  unit: string;
};

type TicketCartItem = {
  id: string;
  optionId?: string;
  productId: TicketProduct["id"];
  quantity: number;
};

type MediaCartItem = {
  id: MediaProduct["id"];
  quantity: number;
};

type BuyerData = {
  curp: string;
  email: string;
  name: string;
  whatsapp: string;
};

type PersistedShopCheckout = {
  buyerData: BuyerData;
  order: ShopOrder;
};

type ShopPaymentProof = {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  dataUrl?: string;
  status: string;
  uploadedAt: string;
};

type ShopOrder = {
  id: string;
  curp: string;
  participantName: string;
  academyName: string;
  venue: string;
  reference: string;
  amount: number;
  paidAmount: number;
  status: "pending_payment" | "payment_reported" | "paid" | "rejected";
  proof?: ShopPaymentProof | null;
};

type MediaParticipantLookupLine = {
  academyName: string;
  category: string;
  genre: string;
  id: string;
  level?: string | null;
  subgenre: string;
  title: string;
  venue: string;
};

type MediaParticipantLookup = {
  academyName: string;
  curp: string;
  lines: MediaParticipantLookupLine[];
  participantName: string;
  venue: string;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

type ShopMode = "tickets" | "media";

const demoBuyerData: BuyerData = {
  curp: "LORM950624MDFPZR09",
  email: "demo.taquilla@levitate.mx",
  name: "María Fernanda López Ruiz",
  whatsapp: "5512345678",
};

const mediaDemoBuyerData: BuyerData = {
  curp: "DEMO010101MDFLVT09",
  email: "demo.fotovideo@levitate.mx",
  name: "María Fernanda López Ruiz",
  whatsapp: "5512345678",
};

const blockOptions: TicketOption[] = [
  { id: "bloque-1", label: "Bloque 1", detail: "14 noviembre · Baby + Petite" },
  { id: "bloque-2", label: "Bloque 2", detail: "14 noviembre · Junior + Teen" },
  { id: "bloque-3", label: "Bloque 3", detail: "14 noviembre · Senior + Legacy + Relevé" },
  { id: "bloque-4", label: "Bloque 4", detail: "14 noviembre · Baby + Petite" },
  { id: "bloque-5", label: "Bloque 5", detail: "15 noviembre · Junior" },
  { id: "bloque-6", label: "Bloque 6", detail: "15 noviembre · Teen + Legacy" },
  { id: "bloque-7", label: "Bloque 7", detail: "15 noviembre · Seniors + Relevé" },
];

const dayOptions: TicketOption[] = [
  { id: "sabado-14", label: "Sábado 14 de noviembre", detail: "Acceso a bloques 1, 2, 3 y 4" },
  { id: "domingo-15", label: "Domingo 15 de noviembre", detail: "Acceso a bloques 5, 6 y 7" },
];

const ticketProducts: TicketProduct[] = [
  {
    id: "block",
    name: "Single pass",
    description: "Acceso individual al bloque de competencia que elijas.",
    price: 250,
    priceNote: "Preventa hasta el 10 de octubre.",
    regularPrice: 350,
    selectionLabel: "Elegir bloque",
    options: blockOptions,
  },
  {
    id: "day",
    name: "Day pass",
    description: "Acceso individual a todos los bloques del día seleccionado.",
    price: 450,
    selectionLabel: "Elegir día",
    options: dayOptions,
  },
  {
    id: "full",
    name: "Full pass",
    description: "Acceso individual a todos los bloques del evento.",
    price: 600,
  },
];

const admissionRules = [
  "El acceso y lugares disponibles son por orden de llegada.",
  "No se pueden apartar lugares dentro del recinto.",
  "Cada boleto es individual y permite un solo acceso por ticket.",
];

const mediaDeliverables = [
  { amount: "10", icon: Camera, label: "Fotos de acción" },
  { amount: "1", icon: Video, label: "Video de presentación" },
  { amount: "2", icon: Sparkles, label: "Fotos estudio" },
];

const mediaFeatureSlides = [
  "/assets/visuals/community-lyra-smoke.jpg",
  "/assets/visuals/community-kids-stage.jpg",
  "/assets/visuals/community-duo-silks.jpg",
  "/assets/mvp-instruction-primavera-2026-puebla.jpg",
  "/assets/media-shop-aerial-yellow-silks.jpg",
  "/assets/media-shop-medal-portrait.jpg",
  "/assets/media-shop-blue-group-stage.jpg",
];
const mediaFeatureSlideDurationSeconds = 4.5;
const maxPaymentProofBytes = 1800000;
const paymentProofAccept = "image/jpeg,image/png,image/webp,application/pdf";
const allowedPaymentProofTypes = paymentProofAccept.split(",");
const noMediaDancesLinkedMessage = "No hay coreografías vinculadas a este CURP";

const mediaDemoParticipantLookup: MediaParticipantLookup = {
  academyName: "Academia Demo Levitate",
  curp: mediaDemoBuyerData.curp,
  participantName: "Sofía Martínez Demo",
  venue: "edomex",
  lines: [
    {
      academyName: "Academia Demo Levitate",
      category: "solo",
      genre: "aereo",
      id: "demo-aerial-solo",
      level: "principiante",
      subgenre: "tela",
      title: "Demo Aerial Solo",
      venue: "edomex",
    },
    {
      academyName: "Academia Demo Levitate",
      category: "grupo",
      genre: "motion",
      id: "demo-motion-crew",
      level: null,
      subgenre: "jazz",
      title: "Demo Motion Crew",
      venue: "edomex",
    },
  ],
};

const mediaProducts: MediaProduct[] = [
  {
    id: "solo",
    name: "Solos",
    description: "Paquete all inclusive para participación individual.",
    price: 1000,
    unit: "precio final",
  },
  {
    id: "duo",
    name: "Dúos",
    description: "Paquete all inclusive para el dúo.",
    price: 1400,
    unit: "precio final",
  },
  {
    id: "trio",
    name: "Tríos",
    description: "Paquete all inclusive para el trío.",
    price: 1800,
    unit: "precio final",
  },
  {
    id: "group",
    name: "Grupos",
    description: "Paquete all inclusive para el grupo.",
    price: 2000,
    unit: "precio final",
  },
];

const boxOfficeSteps = [
  {
    icon: Ticket,
    title: "Elige tus boletos",
    bullets: admissionRules,
  },
  {
    icon: CreditCard,
    title: "Paga por transferencia",
    text: "El checkout muestra el total final, datos bancarios, referencia única y carga de comprobante.",
  },
  {
    icon: FileCheck2,
    title: "Recibe tus accesos",
    text: "Cuando administración confirme el pago, llegarán por correo y WhatsApp tus accesos con QR.",
  },
];

const ticketPaymentMethods = [
  {
    id: "bbva-taquilla",
    title: "BBVA",
    rows: [
      { label: "Titular", value: "Alexia Sofía Jaimes Ponce" },
      { label: "CLABE", value: "012 180 0150 8687132 1" },
      { label: "Cuenta", value: "150 868 7132" },
    ],
  },
];

const photoVideoPaymentMethods = [
  {
    id: "bbva",
    title: "BBVA",
    rows: [
      { label: "A nombre de", value: "Daniel Emiliano Jaimes Ponce" },
      { label: "Banco", value: "BBVA" },
      { label: "CLABE interbancaria", value: "012180015274110441" },
      { label: "Tarjeta", value: "4152313990777117" },
    ],
  },
];

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 0,
  style: "currency",
});

const mediaGenreLabels: Record<string, string> = {
  aereo: "Aerial",
  motion: "Motion",
};

const mediaSubgenreLabels: Record<string, string> = {
  acrojazz: "ACROJAZZ",
  aro: "ARO",
  ballet: "BALLET",
  belly_dance: "BELLY DANCE",
  contemporaneo: "CONTEMPORÁNEO",
  folklore: "FOLKLORE",
  jazz: "JAZZ",
  lirico: "LÍRICO",
  open_aerial: "OPEN: AERIAL",
  open_motion: "OPEN: MOTION",
  tela: "TELA",
  trapecio: "TRAPECIO",
  urbanos: "URBANOS",
};

const mediaCategoryLabels: Record<string, string> = {
  duo: "Dúo",
  grupo: "Grupo",
  solo: "Solo",
  trio: "Trío",
};

const mediaLevelLabels: Record<string, string> = {
  avanzado: "Avanzado",
  elite: "Élite",
  intermedio: "Intermedio",
  nudo: "Nudo",
  principiante: "Principiante",
};

const mediaVenueLabels: Record<string, string> = {
  cdmx: "CDMX - 29 /31 mayo 2026",
  edomex: "Otoño 2026 - Estado de México",
  puebla: "Puebla",
  veracruz: "Primavera 2027 - Veracruz",
};

const ticketCartCookieName = "levitate_ticket_cart";
const mediaCartCookieName = "levitate_media_cart";
const ticketCheckoutCookieName = "levitate_ticket_checkout";
const mediaCheckoutCookieName = "levitate_media_checkout";
const cartCookieMaxAgeSeconds = 60 * 60 * 24 * 30;

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function getProduct(productId: TicketProduct["id"]) {
  return ticketProducts.find((product) => product.id === productId) ?? ticketProducts[0];
}

function getMediaProduct(productId: MediaProduct["id"]) {
  return mediaProducts.find((product) => product.id === productId) ?? mediaProducts[0];
}

function getOption(product: TicketProduct, optionId?: string) {
  return optionId ? product.options?.find((option) => option.id === optionId) : undefined;
}

function getCartItemId(productId: TicketProduct["id"], optionId?: string) {
  return `${productId}:${optionId ?? "general"}`;
}

function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return "";
  }

  const prefix = `${name}=`;
  const cookie = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return cookie ? cookie.slice(prefix.length) : "";
}

function writeCookieValue(name: string, value: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${cartCookieMaxAgeSeconds}; Path=/; SameSite=Lax`;
}

function clearCookieValue(name: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function readCartCookie<T>(name: string, normalizeItem: (item: unknown) => T | null) {
  const storedValue = readCookieValue(name);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(decodeURIComponent(storedValue));
    return Array.isArray(parsedValue)
      ? parsedValue.map(normalizeItem).filter((item): item is T => Boolean(item))
      : [];
  } catch {
    return [];
  }
}

function writeCartCookie<T>(name: string, items: T[]) {
  if (!items.length) {
    clearCookieValue(name);
    return;
  }

  writeCookieValue(name, JSON.stringify(items));
}

function normalizeStoredTicketCartItem(item: unknown): TicketCartItem | null {
  const candidate = item as Partial<TicketCartItem> | null;
  const productId = candidate?.productId;
  const product = ticketProducts.find((ticketProduct) => ticketProduct.id === productId);
  const optionId = typeof candidate?.optionId === "string" ? candidate.optionId : undefined;
  const hasValidOption = !optionId || product?.options?.some((option) => option.id === optionId);
  const quantity = Number(candidate?.quantity);

  if (!product || !hasValidOption || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return null;
  }

  return {
    id: getCartItemId(product.id, optionId),
    optionId,
    productId: product.id,
    quantity,
  };
}

function normalizeStoredMediaCartItem(item: unknown): MediaCartItem | null {
  const candidate = item as Partial<MediaCartItem> | null;
  const product = mediaProducts.find((mediaProduct) => mediaProduct.id === candidate?.id);
  const quantity = Number(candidate?.quantity);

  if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return null;
  }

  return {
    id: product.id,
    quantity,
  };
}

function normalizeStoredBuyerData(value: unknown): BuyerData | null {
  const candidate = value as Partial<BuyerData> | null;
  const curp = normalizeCurp(String(candidate?.curp ?? ""));
  const email = String(candidate?.email ?? "").trim();
  const name = String(candidate?.name ?? "").trim();
  const whatsapp = normalizePhone(String(candidate?.whatsapp ?? ""));

  if (!name || curp.length !== 18 || whatsapp.length < 8 || !/^\S+@\S+\.\S+$/.test(email)) {
    return null;
  }

  return {
    curp,
    email,
    name,
    whatsapp,
  };
}

function normalizeStoredShopOrder(value: unknown): ShopOrder | null {
  const candidate = value as Partial<ShopOrder> | null;
  const status = candidate?.status;
  const amount = Number(candidate?.amount);
  const paidAmount = Number(candidate?.paidAmount ?? 0);
  const validStatuses: ShopOrder["status"][] = ["pending_payment", "payment_reported", "paid", "rejected"];

  if (
    typeof candidate?.id !== "string" ||
    typeof candidate?.reference !== "string" ||
    typeof candidate?.curp !== "string" ||
    typeof candidate?.participantName !== "string" ||
    typeof candidate?.academyName !== "string" ||
    typeof candidate?.venue !== "string" ||
    !validStatuses.includes(status as ShopOrder["status"]) ||
    !Number.isFinite(amount) ||
    !Number.isFinite(paidAmount)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    curp: normalizeCurp(candidate.curp),
    participantName: candidate.participantName,
    academyName: candidate.academyName,
    venue: candidate.venue,
    reference: candidate.reference,
    amount,
    paidAmount,
    status: status as ShopOrder["status"],
    proof: candidate.proof ?? null,
  };
}

function readCheckoutCookie(name: string): PersistedShopCheckout | null {
  const storedValue = readCookieValue(name);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(decodeURIComponent(storedValue)) as Partial<PersistedShopCheckout>;
    const buyerData = normalizeStoredBuyerData(parsedValue.buyerData);
    const order = normalizeStoredShopOrder(parsedValue.order);

    return buyerData && order ? { buyerData, order } : null;
  } catch {
    return null;
  }
}

function writeCheckoutCookie(name: string, buyerData: BuyerData, order: ShopOrder) {
  const storedBuyerData = normalizeStoredBuyerData(buyerData);
  const storedOrder = normalizeStoredShopOrder(order);

  if (!storedBuyerData || !storedOrder) {
    clearCookieValue(name);
    return;
  }

  writeCookieValue(name, JSON.stringify({ buyerData: storedBuyerData, order: storedOrder }));
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

function normalizeCurp(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18).toUpperCase();
}

async function requestShopApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || "No pudimos completar la operación.";
    throw new Error(message);
  }

  return payload as T;
}

function getPaymentProofFileError(file: File) {
  if (file.size > maxPaymentProofBytes) {
    return "El comprobante debe pesar menos de 1.8 MB.";
  }

  if (!allowedPaymentProofTypes.includes(file.type)) {
    return "Sube una imagen JPG, PNG, WEBP o un PDF.";
  }

  return "";
}

function readPaymentProofFile(file: File) {
  return new Promise<{ contentType: string; dataUrl: string; fileName: string; fileSize: number }>((resolve, reject) => {
    const validationError = getPaymentProofFileError(file);

    if (validationError) {
      reject(new Error(validationError));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("No pudimos leer el comprobante."));
    reader.onload = () => {
      resolve({
        contentType: file.type,
        dataUrl: String(reader.result || ""),
        fileName: file.name,
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);
  });
}

function buildTicketReference(name: string, phone: string) {
  const cleanName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 4)
    .toUpperCase();
  const phoneTail = normalizePhone(phone).slice(-4) || "0000";

  return `LEV-TAQ-${cleanName || "BOLE"}-${phoneTail}`;
}

function buildMediaReference(name: string, phone: string, danceId?: string) {
  const cleanName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 4)
    .toUpperCase();
  const phoneTail = normalizePhone(phone).slice(-4) || "0000";
  const danceCode = (danceId ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase();

  return `LEV-FV-${cleanName || "FOTO"}${danceCode ? `-${danceCode}` : ""}-${phoneTail}`;
}

function getMediaLineTitle(line: MediaParticipantLookupLine) {
  return line.title || mediaSubgenreLabels[line.subgenre] || mediaGenreLabels[line.genre] || "Coreografía";
}

function getMediaLineMeta(line: MediaParticipantLookupLine) {
  const parts = [
    mediaGenreLabels[line.genre] ?? line.genre,
    mediaSubgenreLabels[line.subgenre] ?? line.subgenre,
    mediaCategoryLabels[line.category] ?? line.category,
  ];

  if (line.level) {
    parts.push(mediaLevelLabels[line.level] ?? line.level);
  }

  return parts.join(" · ");
}

function getMediaVenueLabel(venue?: string | null) {
  return venue ? mediaVenueLabels[venue] ?? venue : "Sede pendiente";
}

function getShopModeFromHash() {
  if (typeof window === "undefined") {
    return "tickets";
  }

  const normalizedHash = window.location.hash.toLowerCase();
  return normalizedHash === "#foto-video" || normalizedHash === "#fotografia-video" || normalizedHash === "#fotografia-y-video"
    ? "media"
    : "tickets";
}

function useShopMode(initialMode?: ShopMode) {
  const [shopMode, setShopMode] = useState<ShopMode>(() => initialMode ?? getShopModeFromHash());

  useEffect(() => {
    if (initialMode) {
      setShopMode(initialMode);
      return undefined;
    }

    const updateShopMode = () => setShopMode(getShopModeFromHash());

    window.addEventListener("hashchange", updateShopMode);
    return () => window.removeEventListener("hashchange", updateShopMode);
  }, [initialMode]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [shopMode]);

  return shopMode;
}

export function ShopPage({ initialMode }: { initialMode?: ShopMode }) {
  const shopMode = useShopMode(initialMode);

  return shopMode === "media" ? <PhotoVideoShopPage /> : <TicketShopPage />;
}

function TicketShopPage() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({
    block: blockOptions[0]?.id ?? "",
    day: dayOptions[0]?.id ?? "",
  });
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({
    block: 1,
    day: 1,
    full: 1,
  });
  const [cartItems, setCartItems] = useState<TicketCartItem[]>(() => (
    readCartCookie(ticketCartCookieName, normalizeStoredTicketCartItem)
  ));
  const [storedCheckout] = useState<PersistedShopCheckout | null>(() => readCheckoutCookie(ticketCheckoutCookieName));
  const [buyerData, setBuyerData] = useState<BuyerData>(() => storedCheckout?.buyerData ?? {
    curp: "",
    email: "",
    name: "",
    whatsapp: "",
  });
  const [buyerError, setBuyerError] = useState("");
  const [isBuyerConfirmed, setIsBuyerConfirmed] = useState(Boolean(storedCheckout?.order));
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [orderReference, setOrderReference] = useState(storedCheckout?.order.reference ?? "");
  const [proofFileName, setProofFileName] = useState(storedCheckout?.order.proof?.fileName ?? "");
  const [proofMessage, setProofMessage] = useState(
    storedCheckout?.order ? "Orden recuperada. Usa esta referencia como concepto de transferencia." : "",
  );
  const [isProofSubmitted, setIsProofSubmitted] = useState(Boolean(storedCheckout?.order.proof));
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [shopOrder, setShopOrder] = useState<ShopOrder | null>(storedCheckout?.order ?? null);
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const selectedPaymentMethod = ticketPaymentMethods[0];
  const cartLines = useMemo(
    () =>
      cartItems.map((item) => {
        const product = getProduct(item.productId);
        return {
          ...item,
          option: getOption(product, item.optionId),
          product,
        };
      }),
    [cartItems],
  );
  const ticketCount = cartLines.reduce((total, line) => total + line.quantity, 0);
  const total = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const hasUploadedProof = (Boolean(shopOrder?.proof) || isProofSubmitted) && shopOrder?.status !== "rejected";

  useEffect(() => {
    writeCartCookie(ticketCartCookieName, cartItems);
  }, [cartItems]);

  useEffect(() => {
    if (!isCartOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCartOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCartOpen]);

  const clearPaymentProof = () => {
    setProofFileName("");
    setProofMessage("");
    setIsProofSubmitted(false);
    setSelectedProofFile(null);
    if (proofInputRef.current) {
      proofInputRef.current.value = "";
    }
  };

  const markCheckoutDirty = () => {
    setIsBuyerConfirmed(false);
    setOrderReference("");
    setShopOrder(null);
    clearCookieValue(ticketCheckoutCookieName);
    clearPaymentProof();
  };

  const markCartUpdated = () => {
    setBuyerError("");
    if (isBuyerConfirmed) {
      markCheckoutDirty();
      return;
    }

    clearPaymentProof();
  };

  const updateDraftQuantity = (productId: TicketProduct["id"], step: number) => {
    setDraftQuantities((current) => {
      const nextQuantity = Math.min(Math.max((current[productId] ?? 1) + step, 1), 20);
      return { ...current, [productId]: nextQuantity };
    });
  };

  const addTicket = (product: TicketProduct) => {
    const optionId = product.options?.length ? selectedOptions[product.id] : undefined;
    const quantity = draftQuantities[product.id] ?? 1;
    const itemId = getCartItemId(product.id, optionId);

    const existingItem = cartItems.find((item) => item.id === itemId);

    setCartItems(
      existingItem
        ? cartItems.map((item) => (
          item.id === itemId ? { ...item, quantity: Math.min(item.quantity + quantity, 99) } : item
        ))
        : [...cartItems, { id: itemId, optionId, productId: product.id, quantity }],
    );
    setIsCartOpen(true);
    markCartUpdated();
  };

  const changeCartQuantity = (itemId: string, step: number) => {
    setCartItems(
      cartItems
        .map((item) => (item.id === itemId ? { ...item, quantity: item.quantity + step } : item))
        .filter((item) => item.quantity > 0),
    );
    markCartUpdated();
  };

  const removeCartItem = (itemId: string) => {
    setCartItems(cartItems.filter((item) => item.id !== itemId));
    markCartUpdated();
  };

  const updateBuyerData = (field: keyof BuyerData) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = field === "whatsapp"
      ? normalizePhone(event.target.value)
      : field === "curp"
        ? normalizeCurp(event.target.value)
        : event.target.value;
    setBuyerData((current) => ({ ...current, [field]: value }));
    setBuyerError("");
    if (isBuyerConfirmed) {
      markCheckoutDirty();
    }
  };

  const autofillDemoBuyerData = () => {
    setBuyerData(demoBuyerData);
    setBuyerError("");

    if (isBuyerConfirmed) {
      markCheckoutDirty();
    }
  };

  const handleBuyerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (ticketCount === 0) {
      setBuyerError("Agrega al menos un boleto al carrito.");
      return;
    }

    if (!buyerData.name.trim()) {
      setBuyerError("Ingresa el nombre del titular o responsable.");
      return;
    }

    if (normalizeCurp(buyerData.curp).length !== 18) {
      setBuyerError("Ingresa la CURP completa del participante.");
      return;
    }

    if (normalizePhone(buyerData.whatsapp).length < 8) {
      setBuyerError("Ingresa un WhatsApp válido.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(buyerData.email.trim())) {
      setBuyerError("Ingresa un correo válido.");
      return;
    }

    const confirmedBuyerData = {
      curp: normalizeCurp(buyerData.curp),
      email: buyerData.email.trim(),
      name: buyerData.name.trim(),
      whatsapp: normalizePhone(buyerData.whatsapp),
    };

    setIsCreatingOrder(true);
    setBuyerError("");
    setProofMessage("");

    try {
      const payload = await requestShopApi<{ order: ShopOrder }>("/api/registration/shop/order", {
        body: JSON.stringify({
          buyerEmail: confirmedBuyerData.email,
          buyerName: confirmedBuyerData.name,
          buyerPhoneCountryCode: "+52",
          buyerPhoneNumber: confirmedBuyerData.whatsapp,
          curp: confirmedBuyerData.curp,
          items: cartLines.map((line) => ({
            optionId: line.optionId,
            optionLabel: line.option?.label,
            productId: line.product.id,
            quantity: line.quantity,
          })),
        }),
        method: "POST",
      });

      setShopOrder(payload.order);
      setBuyerData(confirmedBuyerData);
      setOrderReference(payload.order.reference);
      setIsBuyerConfirmed(true);
      setProofFileName(payload.order.proof?.fileName ?? "");
      setIsProofSubmitted(Boolean(payload.order.proof));
      writeCheckoutCookie(ticketCheckoutCookieName, confirmedBuyerData, payload.order);
      setProofMessage("Orden generada. Usa esta referencia como concepto de transferencia.");
    } catch (error) {
      setBuyerError(error instanceof Error ? error.message : "No pudimos generar la orden.");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleProofFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0] ?? null;

    if (hasUploadedProof) {
      setSelectedProofFile(null);
      input.value = "";
      return;
    }

    if (!file) {
      setSelectedProofFile(null);
      setProofMessage("");
      return;
    }

    if (!shopOrder) {
      setSelectedProofFile(null);
      setProofMessage("");
      setBuyerError("Primero genera la orden de pago.");
      input.value = "";
      return;
    }

    const validationError = getPaymentProofFileError(file);

    if (validationError) {
      setSelectedProofFile(null);
      setProofMessage("");
      setBuyerError(validationError);
      input.value = "";
      return;
    }

    setSelectedProofFile(file);
    setBuyerError("");
    setProofMessage("");
    input.value = "";
  };

  const handleProofSubmit = async () => {
    if (hasUploadedProof) {
      setSelectedProofFile(null);
      return;
    }

    if (!selectedProofFile) {
      proofInputRef.current?.click();
      return;
    }

    if (!shopOrder) {
      setBuyerError("Primero genera la orden de pago.");
      return;
    }

    const file = selectedProofFile;

    setIsUploadingProof(true);
    setBuyerError("");
    setProofMessage("");

    try {
      const proof = await readPaymentProofFile(file);
      const payload = await requestShopApi<{ order: ShopOrder }>("/api/registration/shop/order/proof", {
        body: JSON.stringify({
          ...proof,
          curp: shopOrder.curp,
          orderId: shopOrder.id,
        }),
        method: "POST",
      });

      setShopOrder(payload.order);
      setOrderReference(payload.order.reference);
      setProofFileName(payload.order.proof?.fileName ?? file.name);
      setIsProofSubmitted(true);
      setSelectedProofFile(null);
      setCartItems([]);
      clearCookieValue(ticketCartCookieName);
      clearCookieValue(ticketCheckoutCookieName);
      setProofMessage("Comprobante cargado. Administración revisará tu pago y te contactará por WhatsApp.");
    } catch (error) {
      setBuyerError(error instanceof Error ? error.message : "No pudimos subir el comprobante.");
    } finally {
      setIsUploadingProof(false);
    }
  };

  const renderBoxOfficeIntro = () => (
    <section className="ticket-shop-how ticket-shop-how--intro" aria-labelledby="ticket-shop-title">
      <div>
        <h1 id="ticket-shop-title">Taquilla Oficial.</h1>
      </div>
      <div className="ticket-shop-how__grid">
        {boxOfficeSteps.map((step) => {
          const StepIcon = step.icon;

          return (
            <article key={step.title}>
              <StepIcon aria-hidden="true" size={24} />
              <strong>{step.title}</strong>
              {step.bullets ? (
                <ul>
                  {step.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <span>{step.text}</span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );

  const renderTransferCheckout = () => (
    <section className="ticket-shop-payment" aria-label="Checkout por transferencia" aria-live="polite">
      <header>
        <CreditCard aria-hidden="true" size={22} />
        <span>Checkout</span>
      </header>

      <div className="ticket-shop-payment__summary">
        <span>Total final</span>
        <strong>{formatCurrency(shopOrder?.amount ?? total)}</strong>
        <small>Referencia: {orderReference}</small>
      </div>

      <dl className="ticket-shop-payment__details">
        {selectedPaymentMethod.rows.map((row) => (
          <div key={`${selectedPaymentMethod.id}-${row.label}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        <div>
          <dt>Concepto / referencia</dt>
          <dd>{orderReference}</dd>
        </div>
      </dl>

      {hasUploadedProof ? (
        <div className="ticket-shop-proof">
          <strong>Comprobante cargado</strong>
          {proofFileName ? <p>{proofFileName}</p> : null}
          {proofMessage ? <p>{proofMessage}</p> : null}
        </div>
      ) : (
        <div className="ticket-shop-proof">
          <input
            accept={paymentProofAccept}
            onChange={handleProofFileChange}
            ref={proofInputRef}
            type="file"
          />
          <button disabled={isUploadingProof} onClick={handleProofSubmit} type="button">
            <UploadCloud aria-hidden="true" size={20} />
            {isUploadingProof ? "Subiendo comprobante..." : selectedProofFile ? "Enviar comprobante" : "Seleccionar comprobante"}
          </button>
          {selectedProofFile ? <strong>{selectedProofFile.name}</strong> : null}
          {selectedProofFile ? (
            <button
              className="ticket-shop-proof__change"
              disabled={isUploadingProof}
              onClick={() => proofInputRef.current?.click()}
              type="button"
            >
              Cambiar archivo
            </button>
          ) : null}
          {proofMessage ? <p>{proofMessage}</p> : null}
        </div>
      )}

      <div className="ticket-shop-confirmation-note">
        <ShieldCheck aria-hidden="true" size={21} />
        <span>
          Al confirmarse el pago, enviaremos tus accesos con QR por correo y WhatsApp.
        </span>
      </div>
    </section>
  );

  return (
    <main className="ticket-shop-page levitate-home-redesign">
      <LevitateHeader activeLabel="Tienda" tone="light" useRootLinks variant="pill" />

      <section className="ticket-shop" id="boletos" aria-labelledby="ticket-shop-title">
        {renderBoxOfficeIntro()}

        <div className="ticket-shop__layout">
          <div className="ticket-shop__main">
            <section className="ticket-shop-deadline ticket-shop-deadline--inline" aria-label="Fecha límite de compra">
              <CalendarDays aria-hidden="true" size={22} />
              <span>
                Último día de compra: <strong>11 de noviembre.</strong> Sin venta el día del evento.
              </span>
              <button
                aria-controls="ticket-shop-checkout"
                aria-expanded={isCartOpen}
                className={`ticket-shop-cart-trigger ticket-shop-cart-trigger--inline${isCartOpen ? " is-hidden" : ""}`}
                onClick={() => setIsCartOpen(true)}
                type="button"
              >
                <ShoppingCart aria-hidden="true" size={19} />
                <span>Carrito</span>
                <strong>{ticketCount}</strong>
              </button>
            </section>

            <section className="ticket-shop-products" aria-label="Tipos de boleto">
              {ticketProducts.map((product) => (
                <article className="ticket-shop-product" key={product.id}>
                  <div className="ticket-shop-product__copy">
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                    <div className="ticket-shop-product__price">
                      <strong>{formatCurrency(product.price)}</strong>
                      {product.regularPrice ? <span>Normal {formatCurrency(product.regularPrice)}</span> : null}
                      {product.priceNote ? <small>{product.priceNote}</small> : null}
                    </div>
                  </div>

                  <div className="ticket-shop-product__controls">
                    {product.options ? (
                      <label>
                        <span>{product.selectionLabel}</span>
                        <select
                          onChange={(event) => setSelectedOptions((current) => ({ ...current, [product.id]: event.target.value }))}
                          value={selectedOptions[product.id]}
                        >
                          {product.options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label} · {option.detail}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="ticket-shop-product__included">
                        <PackageCheck aria-hidden="true" size={18} />
                        <span>Incluye todos los bloques del evento.</span>
                      </div>
                    )}

                    <div className="ticket-shop-stepper" aria-label={`Cantidad de ${product.name}`}>
                      <button onClick={() => updateDraftQuantity(product.id, -1)} type="button">
                        <Minus aria-hidden="true" size={16} />
                      </button>
                      <strong>{draftQuantities[product.id] ?? 1}</strong>
                      <button onClick={() => updateDraftQuantity(product.id, 1)} type="button">
                        <Plus aria-hidden="true" size={16} />
                      </button>
                    </div>

                    <button className="ticket-shop-add" onClick={() => addTicket(product)} type="button">
                      Agregar <ShoppingCart aria-hidden="true" size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </section>

          </div>
          <button
            className={`ticket-shop-cart-backdrop${isCartOpen ? " is-open" : ""}`}
            aria-label="Cerrar carrito"
            onClick={() => setIsCartOpen(false)}
            type="button"
          />

          <aside
            aria-label="Carrito y checkout"
            aria-modal="true"
            className={`ticket-shop-checkout${isCartOpen ? " is-open" : ""}`}
            id="ticket-shop-checkout"
            role="dialog"
          >
            <header className="ticket-shop-drawer-header">
              <div>
                <ShoppingCart aria-hidden="true" size={24} />
                <span>Carrito</span>
                <strong>{ticketCount} {ticketCount === 1 ? "boleto" : "boletos"}</strong>
              </div>
              <button onClick={() => setIsCartOpen(false)} type="button">
                <X aria-hidden="true" size={20} />
                Cerrar
              </button>
            </header>

            <section className="ticket-shop-cart">
              {cartLines.length ? (
                <div className="ticket-shop-cart__lines">
                  {cartLines.map((line) => (
                    <article className="ticket-shop-cart-line" key={line.id}>
                      <div>
                        <strong>{line.product.name}</strong>
                        <span>{line.option ? `${line.option.label} · ${line.option.detail}` : "Acceso completo"}</span>
                        <small>{formatCurrency(line.product.price)} c/u</small>
                      </div>
                      <div className="ticket-shop-cart-line__actions">
                        <button aria-label={`Quitar un ${line.product.name}`} onClick={() => changeCartQuantity(line.id, -1)} type="button">
                          <Minus aria-hidden="true" size={15} />
                        </button>
                        <b>{line.quantity}</b>
                        <button aria-label={`Agregar un ${line.product.name}`} onClick={() => changeCartQuantity(line.id, 1)} type="button">
                          <Plus aria-hidden="true" size={15} />
                        </button>
                        <button aria-label={`Eliminar ${line.product.name}`} onClick={() => removeCartItem(line.id)} type="button">
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ticket-shop-cart__empty">
                  <Ticket aria-hidden="true" size={32} />
                  <strong>Sin boletos todavía.</strong>
                  <span>Elige tus accesos para continuar a checkout.</span>
                </div>
              )}

              <dl className="ticket-shop-total">
                <div>
                  <dt>Total</dt>
                  <dd>{formatCurrency(total)}</dd>
                </div>
              </dl>
            </section>

            <form className="ticket-shop-buyer" onSubmit={handleBuyerSubmit}>
              <header>
                <ReceiptText aria-hidden="true" size={22} />
                <span>Datos del titular</span>
              </header>
              <div className="ticket-shop-buyer__notice">
                <Info aria-hidden="true" size={18} />
                <span>Asegúrate de tener acceso al WhatsApp y correo que registres: tus boletos se entregarán por esos medios.</span>
              </div>
              <button className="ticket-shop-buyer__demo" onClick={autofillDemoBuyerData} type="button">
                Autocompletar demo
              </button>
              <label>
                <span>Nombre del titular o responsable</span>
                <div>
                  <UserRound aria-hidden="true" size={17} />
                  <input autoComplete="name" onChange={updateBuyerData("name")} type="text" value={buyerData.name} />
                </div>
              </label>
              <label>
                <span>CURP del participante</span>
                <div>
                  <FileCheck2 aria-hidden="true" size={17} />
                  <input
                    autoCapitalize="characters"
                    autoComplete="off"
                    inputMode="text"
                    maxLength={18}
                    onChange={updateBuyerData("curp")}
                    type="text"
                    value={buyerData.curp}
                  />
                </div>
              </label>
              <label>
                <span>WhatsApp</span>
                <div>
                  <Phone aria-hidden="true" size={17} />
                  <input autoComplete="tel" inputMode="tel" onChange={updateBuyerData("whatsapp")} type="tel" value={buyerData.whatsapp} />
                </div>
              </label>
              <label>
                <span>Correo</span>
                <div>
                  <Mail aria-hidden="true" size={17} />
                  <input autoComplete="email" onChange={updateBuyerData("email")} type="email" value={buyerData.email} />
                </div>
              </label>
              {buyerError ? <p role="alert">{buyerError}</p> : null}
              {!isBuyerConfirmed ? (
                <button disabled={ticketCount === 0 || isCreatingOrder} type="submit">
                  {isCreatingOrder ? "Generando orden..." : "Continuar a checkout"} <ArrowRight aria-hidden="true" size={18} />
                </button>
              ) : null}
            </form>
            {isBuyerConfirmed && shopOrder ? renderTransferCheckout() : null}
          </aside>
        </div>

      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}

function PhotoVideoShopPage() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({
    solo: 1,
    duo: 1,
    trio: 1,
    group: 1,
  });
  const [cartItems, setCartItems] = useState<MediaCartItem[]>(() => (
    readCartCookie(mediaCartCookieName, normalizeStoredMediaCartItem)
  ));
  const [storedCheckout] = useState<PersistedShopCheckout | null>(() => readCheckoutCookie(mediaCheckoutCookieName));
  const [buyerData, setBuyerData] = useState<BuyerData>(() => storedCheckout?.buyerData ?? {
    curp: "",
    email: "",
    name: "",
    whatsapp: "",
  });
  const [buyerError, setBuyerError] = useState("");
  const [isBuyerConfirmed, setIsBuyerConfirmed] = useState(Boolean(storedCheckout?.order));
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isParticipantLookupLoading, setIsParticipantLookupLoading] = useState(false);
  const [orderReference, setOrderReference] = useState(storedCheckout?.order.reference ?? "");
  const [participantLookup, setParticipantLookup] = useState<MediaParticipantLookup | null>(null);
  const [proofFileName, setProofFileName] = useState(storedCheckout?.order.proof?.fileName ?? "");
  const [proofMessage, setProofMessage] = useState(
    storedCheckout?.order ? "Orden recuperada. Usa esta referencia como concepto de transferencia." : "",
  );
  const [isProofSubmitted, setIsProofSubmitted] = useState(Boolean(storedCheckout?.order.proof));
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [selectedDanceId, setSelectedDanceId] = useState("");
  const [shopOrder, setShopOrder] = useState<ShopOrder | null>(storedCheckout?.order ?? null);
  const [mediaFeatureSlideIndex, setMediaFeatureSlideIndex] = useState(0);
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const selectedPaymentMethod = photoVideoPaymentMethods[0];
  const cartLines = useMemo(
    () =>
      cartItems.map((item) => ({
        ...item,
        product: getMediaProduct(item.id),
      })),
    [cartItems],
  );
  const mediaItemCount = cartLines.reduce((total, line) => total + line.quantity, 0);
  const total = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const selectedDance = participantLookup?.lines.find((line) => line.id === selectedDanceId) ?? null;
  const activeMediaFeatureSlide = mediaFeatureSlides[mediaFeatureSlideIndex] ?? mediaFeatureSlides[0];
  const hasUploadedProof = (Boolean(shopOrder?.proof) || isProofSubmitted) && shopOrder?.status !== "rejected";

  useEffect(() => {
    writeCartCookie(mediaCartCookieName, cartItems);
  }, [cartItems]);

  useEffect(() => {
    if (!isCartOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCartOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCartOpen]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMediaFeatureSlideIndex((currentIndex) => (currentIndex + 1) % mediaFeatureSlides.length);
    }, mediaFeatureSlideDurationSeconds * 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const nextSlide = mediaFeatureSlides[(mediaFeatureSlideIndex + 1) % mediaFeatureSlides.length];
    const image = new Image();
    image.src = nextSlide;
  }, [mediaFeatureSlideIndex]);

  const clearPaymentProof = () => {
    setProofFileName("");
    setProofMessage("");
    setIsProofSubmitted(false);
    setSelectedProofFile(null);
    if (proofInputRef.current) {
      proofInputRef.current.value = "";
    }
  };

  const markCheckoutDirty = () => {
    setIsBuyerConfirmed(false);
    setOrderReference("");
    setShopOrder(null);
    clearCookieValue(mediaCheckoutCookieName);
    clearPaymentProof();
  };

  const markCartUpdated = () => {
    setBuyerError("");
    if (isBuyerConfirmed) {
      markCheckoutDirty();
      return;
    }

    clearPaymentProof();
  };

  const updateDraftQuantity = (productId: MediaProduct["id"], step: number) => {
    setDraftQuantities((current) => {
      const nextQuantity = Math.min(Math.max((current[productId] ?? 1) + step, 1), 99);
      return { ...current, [productId]: nextQuantity };
    });
  };

  const addPackage = (product: MediaProduct) => {
    const quantity = draftQuantities[product.id] ?? 1;
    const existingItem = cartItems.find((item) => item.id === product.id);

    setCartItems(
      existingItem
        ? cartItems.map((item) => (
          item.id === product.id ? { ...item, quantity: Math.min(item.quantity + quantity, 99) } : item
        ))
        : [...cartItems, { id: product.id, quantity }],
    );
    setIsCartOpen(true);
    markCartUpdated();
  };

  const changeCartQuantity = (itemId: MediaProduct["id"], step: number) => {
    setCartItems(
      cartItems
        .map((item) => (item.id === itemId ? { ...item, quantity: item.quantity + step } : item))
        .filter((item) => item.quantity > 0),
    );
    markCartUpdated();
  };

  const removeCartItem = (itemId: MediaProduct["id"]) => {
    setCartItems(cartItems.filter((item) => item.id !== itemId));
    markCartUpdated();
  };

  const updateBuyerData = (field: keyof BuyerData) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = field === "whatsapp"
      ? normalizePhone(event.target.value)
      : field === "curp"
        ? normalizeCurp(event.target.value)
        : event.target.value;
    setBuyerData((current) => ({ ...current, [field]: value }));
    setBuyerError("");

    if (field === "curp") {
      setParticipantLookup(null);
      setSelectedDanceId("");
    }

    if (isBuyerConfirmed) {
      markCheckoutDirty();
    }
  };

  const autofillDemoBuyerData = () => {
    setBuyerData(mediaDemoBuyerData);
    setBuyerError("");
    setParticipantLookup(mediaDemoParticipantLookup);
    setSelectedDanceId("");

    if (isBuyerConfirmed) {
      markCheckoutDirty();
    }
  };

  const lookupParticipantDances = async () => {
    const normalizedCurp = normalizeCurp(buyerData.curp);
    setBuyerData((current) => ({ ...current, curp: normalizedCurp }));
    setBuyerError("");
    setParticipantLookup(null);
    setSelectedDanceId("");

    if (isBuyerConfirmed) {
      markCheckoutDirty();
    }

    if (normalizedCurp.length !== 18) {
      setBuyerError("Ingresa la CURP completa para buscar sus coreografías.");
      return;
    }

    if (normalizedCurp === mediaDemoBuyerData.curp) {
      setParticipantLookup(mediaDemoParticipantLookup);
      return;
    }

    setIsParticipantLookupLoading(true);

    try {
      const response = await fetch("/api/registration/inscription/payment-lookup", {
        body: JSON.stringify({ curp: normalizedCurp }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as MediaParticipantLookup | ApiErrorResponse | null;

      if (!response.ok) {
        const errorPayload = payload as ApiErrorResponse | null;
        const shouldShowMissingDancesMessage =
          response.status === 401 ||
          response.status === 403 ||
          response.status === 404 ||
          errorPayload?.error?.message === "Inicia sesión para consultar una inscripción";

        throw new Error(
          shouldShowMissingDancesMessage
            ? noMediaDancesLinkedMessage
            : errorPayload?.error?.message ?? "No pudimos consultar esa CURP.",
        );
      }

      if (!payload || !("curp" in payload) || !Array.isArray(payload.lines)) {
        throw new Error("La respuesta de la consulta no fue válida.");
      }

      setParticipantLookup(payload);
      setSelectedDanceId(payload.lines.length === 1 ? payload.lines[0].id : "");
    } catch (error) {
      setParticipantLookup(null);
      setBuyerError(error instanceof Error ? error.message : "No pudimos consultar esa CURP.");
    } finally {
      setIsParticipantLookupLoading(false);
    }
  };

  const selectDance = (danceId: string) => {
    setSelectedDanceId(danceId);
    setBuyerError("");

    if (isBuyerConfirmed) {
      markCheckoutDirty();
    }
  };

  const handleBuyerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mediaItemCount === 0) {
      setBuyerError("Agrega al menos un paquete al carrito.");
      return;
    }

    if (!buyerData.name.trim()) {
      setBuyerError("Ingresa el nombre del titular o responsable.");
      return;
    }

    if (normalizeCurp(buyerData.curp).length !== 18) {
      setBuyerError("Ingresa la CURP completa del participante.");
      return;
    }

    if (!participantLookup || participantLookup.curp !== normalizeCurp(buyerData.curp)) {
      setBuyerError("Busca la CURP para seleccionar la coreografía registrada.");
      return;
    }

    if (!selectedDance) {
      setBuyerError("Selecciona la coreografía a la que irá dirigido el paquete.");
      return;
    }

    if (normalizePhone(buyerData.whatsapp).length < 8) {
      setBuyerError("Ingresa un WhatsApp válido.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(buyerData.email.trim())) {
      setBuyerError("Ingresa un correo válido.");
      return;
    }

    const confirmedBuyerData = {
      curp: normalizeCurp(buyerData.curp),
      email: buyerData.email.trim(),
      name: buyerData.name.trim(),
      whatsapp: normalizePhone(buyerData.whatsapp),
    };

    setIsCreatingOrder(true);
    setBuyerError("");
    setProofMessage("");

    try {
      const payload = await requestShopApi<{ order: ShopOrder }>("/api/registration/shop/order", {
        body: JSON.stringify({
          buyerEmail: confirmedBuyerData.email,
          buyerName: confirmedBuyerData.name,
          buyerPhoneCountryCode: "+52",
          buyerPhoneNumber: confirmedBuyerData.whatsapp,
          curp: confirmedBuyerData.curp,
          danceId: selectedDance.id,
          items: cartLines.map((line) => ({
            danceId: selectedDance.id,
            danceTitle: getMediaLineTitle(selectedDance),
            productId: line.product.id,
            quantity: line.quantity,
          })),
        }),
        method: "POST",
      });

      setShopOrder(payload.order);
      setBuyerData(confirmedBuyerData);
      setOrderReference(payload.order.reference);
      setIsBuyerConfirmed(true);
      setProofFileName(payload.order.proof?.fileName ?? "");
      setIsProofSubmitted(Boolean(payload.order.proof));
      writeCheckoutCookie(mediaCheckoutCookieName, confirmedBuyerData, payload.order);
      setProofMessage("Orden generada. Usa esta referencia como concepto de transferencia.");
    } catch (error) {
      setBuyerError(error instanceof Error ? error.message : "No pudimos generar la orden.");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleProofFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0] ?? null;

    if (hasUploadedProof) {
      setSelectedProofFile(null);
      input.value = "";
      return;
    }

    if (!file) {
      setSelectedProofFile(null);
      setProofMessage("");
      return;
    }

    if (!shopOrder) {
      setSelectedProofFile(null);
      setProofMessage("");
      setBuyerError("Primero genera la orden de pago.");
      input.value = "";
      return;
    }

    const validationError = getPaymentProofFileError(file);

    if (validationError) {
      setSelectedProofFile(null);
      setProofMessage("");
      setBuyerError(validationError);
      input.value = "";
      return;
    }

    setSelectedProofFile(file);
    setBuyerError("");
    setProofMessage("");
    input.value = "";
  };

  const handleProofSubmit = async () => {
    if (hasUploadedProof) {
      setSelectedProofFile(null);
      return;
    }

    if (!selectedProofFile) {
      proofInputRef.current?.click();
      return;
    }

    if (!shopOrder) {
      setBuyerError("Primero genera la orden de pago.");
      return;
    }

    const file = selectedProofFile;

    setIsUploadingProof(true);
    setBuyerError("");
    setProofMessage("");

    try {
      const proof = await readPaymentProofFile(file);
      const payload = await requestShopApi<{ order: ShopOrder }>("/api/registration/shop/order/proof", {
        body: JSON.stringify({
          ...proof,
          curp: shopOrder.curp,
          orderId: shopOrder.id,
        }),
        method: "POST",
      });

      setShopOrder(payload.order);
      setOrderReference(payload.order.reference);
      setProofFileName(payload.order.proof?.fileName ?? file.name);
      setIsProofSubmitted(true);
      setSelectedProofFile(null);
      setCartItems([]);
      clearCookieValue(mediaCartCookieName);
      clearCookieValue(mediaCheckoutCookieName);
      setProofMessage("Comprobante cargado. Administración revisará tu pago y te contactará por WhatsApp.");
    } catch (error) {
      setBuyerError(error instanceof Error ? error.message : "No pudimos subir el comprobante.");
    } finally {
      setIsUploadingProof(false);
    }
  };

  const renderIntro = () => (
    <section className="ticket-shop-how ticket-shop-how--intro media-shop-how--intro" aria-labelledby="media-shop-title">
      <div>
        <h1 id="media-shop-title">Fotografía y Video.</h1>
      </div>
      <div className="ticket-shop-how__grid">
        <article>
          <Camera aria-hidden="true" size={24} />
          <strong>Elige tu paquete</strong>
          <ul>
            <li>Paquete all inclusive.</li>
            <li>El costo cambia por tipo de participación.</li>
          </ul>
        </article>
        <article>
          <CreditCard aria-hidden="true" size={24} />
          <strong>Paga por transferencia</strong>
          <span>El checkout muestra el total final, datos bancarios, referencia única y carga de comprobante.</span>
        </article>
        <article>
          <FileCheck2 aria-hidden="true" size={24} />
          <strong>Recibe tu material</strong>
          <span>Cuando administración confirme el pago, recibirás la confirmación por correo y WhatsApp.</span>
        </article>
      </div>
    </section>
  );

  const renderTransferCheckout = () => (
    <section className="ticket-shop-payment" aria-label="Checkout por transferencia" aria-live="polite">
      <header>
        <CreditCard aria-hidden="true" size={22} />
        <span>Checkout</span>
      </header>

      <div className="ticket-shop-payment__summary">
        <span>Total final</span>
        <strong>{formatCurrency(shopOrder?.amount ?? total)}</strong>
        <small>Referencia: {orderReference}</small>
        {selectedDance ? <small>Coreografía: {getMediaLineTitle(selectedDance)}</small> : null}
      </div>

      <dl className="ticket-shop-payment__details">
        {selectedPaymentMethod.rows.map((row) => (
          <div key={`media-${selectedPaymentMethod.id}-${row.label}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        <div>
          <dt>Concepto / referencia</dt>
          <dd>{orderReference}</dd>
        </div>
        {selectedDance ? (
          <div>
            <dt>Paquete dirigido a</dt>
            <dd>{getMediaLineTitle(selectedDance)} · {getMediaLineMeta(selectedDance)}</dd>
          </div>
        ) : null}
      </dl>

      {hasUploadedProof ? (
        <div className="ticket-shop-proof">
          <strong>Comprobante cargado</strong>
          {proofFileName ? <p>{proofFileName}</p> : null}
          {proofMessage ? <p>{proofMessage}</p> : null}
        </div>
      ) : (
        <div className="ticket-shop-proof">
          <input
            accept={paymentProofAccept}
            onChange={handleProofFileChange}
            ref={proofInputRef}
            type="file"
          />
          <button disabled={isUploadingProof} onClick={handleProofSubmit} type="button">
            <UploadCloud aria-hidden="true" size={20} />
            {isUploadingProof ? "Subiendo comprobante..." : selectedProofFile ? "Enviar comprobante" : "Seleccionar comprobante"}
          </button>
          {selectedProofFile ? <strong>{selectedProofFile.name}</strong> : null}
          {selectedProofFile ? (
            <button
              className="ticket-shop-proof__change"
              disabled={isUploadingProof}
              onClick={() => proofInputRef.current?.click()}
              type="button"
            >
              Cambiar archivo
            </button>
          ) : null}
          {proofMessage ? <p>{proofMessage}</p> : null}
        </div>
      )}

      <div className="ticket-shop-confirmation-note">
        <ShieldCheck aria-hidden="true" size={21} />
        <span>
          Al confirmarse el pago, enviaremos la confirmación por correo y WhatsApp.
        </span>
      </div>
    </section>
  );

  return (
    <main className="ticket-shop-page media-shop-page levitate-home-redesign">
      <LevitateHeader activeLabel="Tienda" tone="light" useRootLinks variant="pill" />

      <section className="ticket-shop media-shop" id="foto-video" aria-labelledby="media-shop-title">
        {renderIntro()}

        <div className="ticket-shop__layout">
          <div className="ticket-shop__main">
            <section className="ticket-shop-deadline ticket-shop-deadline--inline media-shop-package-strip" aria-label="Paquete all inclusive">
              <Camera aria-hidden="true" size={22} />
              <span>
                <strong>Recibe tu paquete</strong> 15 días hábiles posterior al evento.
              </span>
              <button
                aria-controls="media-shop-checkout"
                aria-expanded={isCartOpen}
                className={`ticket-shop-cart-trigger ticket-shop-cart-trigger--inline${isCartOpen ? " is-hidden" : ""}`}
                onClick={() => setIsCartOpen(true)}
                type="button"
              >
                <ShoppingCart aria-hidden="true" size={19} />
                <span>Carrito</span>
                <strong>{mediaItemCount}</strong>
              </button>
            </section>

            <section className="media-shop-feature" aria-label="Cobertura all inclusive">
              <figure className="media-shop-slideshow">
                <img alt="" aria-hidden="true" decoding="async" key={activeMediaFeatureSlide} src={activeMediaFeatureSlide} />
              </figure>
              <div>
                <span>Fotografía y video</span>
                <h2>Paquete all inclusive.</h2>
                <p>Tu cobertura oficial incluye estos entregables; solo cambia el costo por tipo de participación.</p>
                <div className="media-shop-deliverables">
                  {mediaDeliverables.map((deliverable) => {
                    const DeliverableIcon = deliverable.icon;

                    return (
                      <article key={deliverable.label}>
                        <strong>{deliverable.amount}</strong>
                        <span>{deliverable.label}</span>
                        <DeliverableIcon aria-hidden="true" size={20} />
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="ticket-shop-products media-shop-products" aria-label="Tipos de paquete de fotografía y video">
              {mediaProducts.map((product) => (
                <article className="ticket-shop-product media-shop-product" key={product.id}>
                  <div className="ticket-shop-product__copy">
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                    <div className="ticket-shop-product__price">
                      <strong>{formatCurrency(product.price)}</strong>
                      <small>{product.unit}</small>
                    </div>
                  </div>

                  <div className="ticket-shop-product__controls">
                    <div className="ticket-shop-stepper" aria-label={`Cantidad de ${product.name}`}>
                      <button onClick={() => updateDraftQuantity(product.id, -1)} type="button">
                        <Minus aria-hidden="true" size={16} />
                      </button>
                      <strong>{draftQuantities[product.id] ?? 1}</strong>
                      <button onClick={() => updateDraftQuantity(product.id, 1)} type="button">
                        <Plus aria-hidden="true" size={16} />
                      </button>
                    </div>

                    <button className="ticket-shop-add" onClick={() => addPackage(product)} type="button">
                      Agregar <ShoppingCart aria-hidden="true" size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </div>

          <button
            className={`ticket-shop-cart-backdrop${isCartOpen ? " is-open" : ""}`}
            aria-label="Cerrar carrito"
            onClick={() => setIsCartOpen(false)}
            type="button"
          />

          <aside
            aria-label="Carrito y checkout"
            aria-modal="true"
            className={`ticket-shop-checkout${isCartOpen ? " is-open" : ""}`}
            id="media-shop-checkout"
            role="dialog"
          >
            <header className="ticket-shop-drawer-header">
              <div>
                <ShoppingCart aria-hidden="true" size={24} />
                <span>Carrito</span>
                <strong>{mediaItemCount} {mediaItemCount === 1 ? "item" : "items"}</strong>
              </div>
              <button onClick={() => setIsCartOpen(false)} type="button">
                <X aria-hidden="true" size={20} />
                Cerrar
              </button>
            </header>

            <section className="ticket-shop-cart">
              {cartLines.length ? (
                <div className="ticket-shop-cart__lines">
                  {cartLines.map((line) => (
                    <article className="ticket-shop-cart-line" key={line.id}>
                      <div>
                        <strong>{line.product.name}</strong>
                        <span>Paquete all inclusive · {line.product.unit}</span>
                        <small>{formatCurrency(line.product.price)} por paquete</small>
                      </div>
                      <div className="ticket-shop-cart-line__actions">
                        <button aria-label={`Quitar un ${line.product.name}`} onClick={() => changeCartQuantity(line.id, -1)} type="button">
                          <Minus aria-hidden="true" size={15} />
                        </button>
                        <b>{line.quantity}</b>
                        <button aria-label={`Agregar un ${line.product.name}`} onClick={() => changeCartQuantity(line.id, 1)} type="button">
                          <Plus aria-hidden="true" size={15} />
                        </button>
                        <button aria-label={`Eliminar ${line.product.name}`} onClick={() => removeCartItem(line.id)} type="button">
                          <Trash2 aria-hidden="true" size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ticket-shop-cart__empty">
                  <Camera aria-hidden="true" size={32} />
                  <strong>Carrito vacío.</strong>
                  <span>Agrega paquetes de foto y video para ver tu resumen.</span>
                </div>
              )}

              <dl className="ticket-shop-total">
                <div>
                  <dt>Total</dt>
                  <dd>{formatCurrency(total)}</dd>
                </div>
              </dl>
            </section>

            <form className="ticket-shop-buyer" onSubmit={handleBuyerSubmit}>
              <header>
                <ReceiptText aria-hidden="true" size={22} />
                <span>Datos de entrega</span>
              </header>
              <div className="ticket-shop-buyer__notice">
                <Info aria-hidden="true" size={18} />
                <span>Asegúrate de tener acceso al WhatsApp y correo que registres: por esos medios recibirás confirmaciones.</span>
              </div>
              <button className="ticket-shop-buyer__demo" onClick={autofillDemoBuyerData} type="button">
                Autocompletar demo
              </button>
              <label>
                <span>Nombre del titular o responsable</span>
                <div>
                  <UserRound aria-hidden="true" size={17} />
                  <input autoComplete="name" onChange={updateBuyerData("name")} type="text" value={buyerData.name} />
                </div>
              </label>
              <label>
                <span>CURP del participante</span>
                <div>
                  <FileCheck2 aria-hidden="true" size={17} />
                  <input
                    autoCapitalize="characters"
                    autoComplete="off"
                    inputMode="text"
                    maxLength={18}
                    onChange={updateBuyerData("curp")}
                    type="text"
                    value={buyerData.curp}
                  />
                </div>
              </label>
              <div className="media-shop-lookup-actions">
                <button disabled={isParticipantLookupLoading} onClick={lookupParticipantDances} type="button">
                  {isParticipantLookupLoading ? "Buscando..." : "Buscar coreografías"}
                </button>
              </div>
              {participantLookup ? (
                <section className="media-shop-choreography-picker" aria-labelledby="media-shop-dance-picker-title">
                  <header>
                    <span id="media-shop-dance-picker-title">Coreografías registradas</span>
                    <strong>{participantLookup.participantName}</strong>
                    <small>{participantLookup.academyName} · {getMediaVenueLabel(participantLookup.venue)}</small>
                  </header>
                  {participantLookup.lines.length ? (
                    <div className="media-shop-choreography-list">
                      {participantLookup.lines.map((line, index) => (
                        <button
                          aria-pressed={selectedDanceId === line.id}
                          className={selectedDanceId === line.id ? "is-selected" : ""}
                          key={line.id}
                          onClick={() => selectDance(line.id)}
                          type="button"
                        >
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{getMediaLineTitle(line)}</strong>
                          <small>{getMediaLineMeta(line)}</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="media-shop-choreography-empty">
                      <ReceiptText aria-hidden="true" size={22} />
                      <strong>{noMediaDancesLinkedMessage}</strong>
                    </div>
                  )}
                </section>
              ) : null}
              <label>
                <span>WhatsApp</span>
                <div>
                  <Phone aria-hidden="true" size={17} />
                  <input autoComplete="tel" inputMode="tel" onChange={updateBuyerData("whatsapp")} type="tel" value={buyerData.whatsapp} />
                </div>
              </label>
              <label>
                <span>Correo</span>
                <div>
                  <Mail aria-hidden="true" size={17} />
                  <input autoComplete="email" onChange={updateBuyerData("email")} type="email" value={buyerData.email} />
                </div>
              </label>
              {buyerError ? <p role="alert">{buyerError}</p> : null}
              {!isBuyerConfirmed ? (
                <button disabled={mediaItemCount === 0 || isCreatingOrder} type="submit">
                  {isCreatingOrder ? "Generando orden..." : "Continuar a checkout"} <ArrowRight aria-hidden="true" size={18} />
                </button>
              ) : null}
            </form>
            {isBuyerConfirmed && shopOrder ? renderTransferCheckout() : null}
          </aside>
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
