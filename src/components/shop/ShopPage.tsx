import type { ChangeEvent, FormEvent } from "react";
import {
  ArrowRight,
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
  Ticket,
  Trash2,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
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

type TicketCartItem = {
  id: string;
  optionId?: string;
  productId: TicketProduct["id"];
  quantity: number;
};

type BuyerData = {
  curp: string;
  email: string;
  name: string;
  whatsapp: string;
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
    name: "Boleto por bloque",
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
    id: "banamex",
    title: "Banamex",
    rows: [
      { label: "A nombre de", value: "María Laura Ponce" },
      { label: "Número de cuenta", value: "26988 - Sucursal 4770" },
      { label: "CLABE interbancaria", value: "002540477000269880" },
    ],
  },
  {
    id: "spin",
    title: "Spin by Oxxo",
    rows: [
      { label: "A nombre de", value: "Rodolfo Javier Serrano" },
      { label: "CLABE interbancaria", value: "728969000061103602" },
    ],
  },
];

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function getProduct(productId: TicketProduct["id"]) {
  return ticketProducts.find((product) => product.id === productId) ?? ticketProducts[0];
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

export function ShopPage() {
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
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0].id);
  const [proofFileName, setProofFileName] = useState("");
  const [proofMessage, setProofMessage] = useState("");
  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const selectedPaymentMethod = paymentMethods.find((method) => method.id === paymentMethodId) ?? paymentMethods[0];
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

  const markCheckoutDirty = () => {
    setIsBuyerConfirmed(false);
    setOrderReference("");
    setProofFileName("");
    setProofMessage("");
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

    setCartItems((current) => {
      const existingItem = current.find((item) => item.id === itemId);

      if (existingItem) {
        return current.map((item) => (
          item.id === itemId ? { ...item, quantity: Math.min(item.quantity + quantity, 99) } : item
        ));
      }

      return [...current, { id: itemId, optionId, productId: product.id, quantity }];
    });
    markCheckoutDirty();
  };

  const changeCartQuantity = (itemId: string, step: number) => {
    setCartItems((current) =>
      current
        .map((item) => (item.id === itemId ? { ...item, quantity: item.quantity + step } : item))
        .filter((item) => item.quantity > 0),
    );
    markCheckoutDirty();
  };

  const removeCartItem = (itemId: string) => {
    setCartItems((current) => current.filter((item) => item.id !== itemId));
    markCheckoutDirty();
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
        <h1 id="ticket-shop-title">Taquilla Levitate.</h1>
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

      <div className="ticket-shop-payment__tabs" aria-label="Opciones de transferencia">
        {paymentMethods.map((method) => (
          <button
            className={paymentMethodId === method.id ? "is-active" : ""}
            key={method.id}
            onClick={() => setPaymentMethodId(method.id)}
            type="button"
          >
            {method.title}
          </button>
        ))}
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

          <aside className="ticket-shop-checkout" aria-label="Carrito y checkout">
            <section className="ticket-shop-cart">
              <header>
                <div>
                  <ShoppingCart aria-hidden="true" size={22} />
                  <span>Carrito</span>
                </div>
                <strong>{ticketCount} {ticketCount === 1 ? "boleto" : "boletos"}</strong>
              </header>

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
              <button disabled={ticketCount === 0} type="submit">
                {isBuyerConfirmed ? "Actualizar checkout" : "Continuar a checkout"} <ArrowRight aria-hidden="true" size={18} />
              </button>
              {isBuyerConfirmed ? renderTransferCheckout() : null}
            </form>
          </aside>
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
