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
  "/assets/premiation-aerial-medal-system.jpg",
  "/assets/premiation-motion-medal-system.jpg",
  "/assets/ranking-bronce.jpg",
  "/assets/ranking-plata.png",
  "/assets/ranking-oro.png",
  "/assets/levitate-home-hero-poster.jpg",
];

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
    {
      academyName: "Academia Demo Levitate",
      category: "trio",
      genre: "motion",
      id: "demo-lyrical-trio",
      level: "intermedio",
      subgenre: "lirico",
      title: "Demo Lyrical Trío",
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
    unit: "por participación",
  },
  {
    id: "duo",
    name: "Dúos",
    description: "Paquete all inclusive para cada participante del dúo.",
    price: 700,
    unit: "por participante",
  },
  {
    id: "trio",
    name: "Tríos",
    description: "Paquete all inclusive para cada participante del trío.",
    price: 600,
    unit: "por participante",
  },
  {
    id: "group",
    name: "Grupos",
    description: "Paquete all inclusive para cada integrante del grupo.",
    price: 500,
    unit: "por participante",
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

const paymentMethods = [
  {
    id: "banco-azteca",
    title: "Banco Azteca",
    rows: [
      { label: "A nombre de", value: "Alexia Sofía Jaimes Ponce" },
      { label: "Banco", value: "Banco Azteca" },
      { label: "Número de cuenta", value: "42291362894301" },
      { label: "CLABE interbancaria", value: "127540013628943018" },
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
  cdmx: "CDMX",
  edomex: "Estado de México",
  puebla: "Puebla",
};

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

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

function normalizeCurp(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18).toUpperCase();
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

function useShopMode() {
  const [shopMode, setShopMode] = useState(getShopModeFromHash);

  useEffect(() => {
    const updateShopMode = () => setShopMode(getShopModeFromHash());

    window.addEventListener("hashchange", updateShopMode);
    return () => window.removeEventListener("hashchange", updateShopMode);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [shopMode]);

  return shopMode;
}

export function ShopPage() {
  const shopMode = useShopMode();

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
  const [cartItems, setCartItems] = useState<TicketCartItem[]>([]);
  const [buyerData, setBuyerData] = useState<BuyerData>({ curp: "", email: "", name: "", whatsapp: "" });
  const [buyerError, setBuyerError] = useState("");
  const [isBuyerConfirmed, setIsBuyerConfirmed] = useState(false);
  const [orderReference, setOrderReference] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [proofMessage, setProofMessage] = useState("");
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const selectedPaymentMethod = paymentMethods[0];
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
    if (proofInputRef.current) {
      proofInputRef.current.value = "";
    }
  };

  const markCheckoutDirty = () => {
    setIsBuyerConfirmed(false);
    setOrderReference("");
    clearPaymentProof();
  };

  const markCartUpdated = () => {
    setBuyerError("");
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

  const handleBuyerSubmit = (event: FormEvent<HTMLFormElement>) => {
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

    setOrderReference(buildTicketReference(buyerData.name, buyerData.whatsapp));
    setIsBuyerConfirmed(true);
    setProofMessage("");
  };

  const handleProofFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setProofFileName("");
      setProofMessage("");
      return;
    }

    setProofFileName(file.name);
    setProofMessage("Comprobante cargado. Administración revisará tu pago y te contactará por WhatsApp.");
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
        <strong>{formatCurrency(total)}</strong>
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

      <div className="ticket-shop-proof">
        <input
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleProofFileChange}
          ref={proofInputRef}
          type="file"
        />
        <button onClick={() => proofInputRef.current?.click()} type="button">
          <UploadCloud aria-hidden="true" size={20} />
          Subir captura de transferencia
        </button>
        {proofFileName ? <strong>{proofFileName}</strong> : null}
        {proofMessage ? <p>{proofMessage}</p> : null}
      </div>

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
                <button disabled={ticketCount === 0} type="submit">
                  Continuar a checkout <ArrowRight aria-hidden="true" size={18} />
                </button>
              ) : null}
              {isBuyerConfirmed && ticketCount > 0 ? renderTransferCheckout() : null}
            </form>
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
  const [cartItems, setCartItems] = useState<MediaCartItem[]>([]);
  const [buyerData, setBuyerData] = useState<BuyerData>({ curp: "", email: "", name: "", whatsapp: "" });
  const [buyerError, setBuyerError] = useState("");
  const [isBuyerConfirmed, setIsBuyerConfirmed] = useState(false);
  const [isParticipantLookupLoading, setIsParticipantLookupLoading] = useState(false);
  const [orderReference, setOrderReference] = useState("");
  const [participantLookup, setParticipantLookup] = useState<MediaParticipantLookup | null>(null);
  const [proofFileName, setProofFileName] = useState("");
  const [proofMessage, setProofMessage] = useState("");
  const [selectedDanceId, setSelectedDanceId] = useState("");
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const selectedPaymentMethod = paymentMethods[0];
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
    if (proofInputRef.current) {
      proofInputRef.current.value = "";
    }
  };

  const markCheckoutDirty = () => {
    setIsBuyerConfirmed(false);
    setOrderReference("");
    clearPaymentProof();
  };

  const markCartUpdated = () => {
    setBuyerError("");
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
      const response = await fetch("/api/registration/inscription/lookup", {
        body: JSON.stringify({ curp: normalizedCurp }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as MediaParticipantLookup | ApiErrorResponse | null;

      if (!response.ok) {
        const errorPayload = payload as ApiErrorResponse | null;
        throw new Error(errorPayload?.error?.message ?? "No pudimos consultar esa CURP.");
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

  const handleBuyerSubmit = (event: FormEvent<HTMLFormElement>) => {
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

    setOrderReference(buildMediaReference(buyerData.name, buyerData.whatsapp, selectedDance.id));
    setIsBuyerConfirmed(true);
    setProofMessage("");
  };

  const handleProofFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setProofFileName("");
      setProofMessage("");
      return;
    }

    setProofFileName(file.name);
    setProofMessage("Comprobante cargado. Administración revisará tu pago y te contactará por WhatsApp.");
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
        <strong>{formatCurrency(total)}</strong>
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

      <div className="ticket-shop-proof">
        <input
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleProofFileChange}
          ref={proofInputRef}
          type="file"
        />
        <button onClick={() => proofInputRef.current?.click()} type="button">
          <UploadCloud aria-hidden="true" size={20} />
          Subir captura de transferencia
        </button>
        {proofFileName ? <strong>{proofFileName}</strong> : null}
        {proofMessage ? <p>{proofMessage}</p> : null}
      </div>

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
                {mediaFeatureSlides.map((image, index) => (
                  <img
                    alt=""
                    aria-hidden="true"
                    key={image}
                    loading={index === 0 ? "eager" : "lazy"}
                    src={image}
                    style={{ animationDelay: `${index * 2}s` }}
                  />
                ))}
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
                      <strong>No hay coreografías asociadas a esta CURP.</strong>
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
                <button disabled={mediaItemCount === 0} type="submit">
                  Continuar a checkout <ArrowRight aria-hidden="true" size={18} />
                </button>
              ) : null}
              {isBuyerConfirmed && mediaItemCount > 0 ? renderTransferCheckout() : null}
            </form>
          </aside>
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
