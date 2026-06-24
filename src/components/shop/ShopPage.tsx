import {
  Camera,
  ChevronRight,
  CreditCard,
  Minus,
  PackageCheck,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Ticket,
  Trash2,
  UserRound,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type ShopProduct = {
  id: string;
  name: string;
  category: "Boletos" | "Fotografía y video";
  description: string;
  price: number;
  regularPrice?: number;
  badge?: string;
  image?: string;
  details?: string[];
  visual: "ticket" | "photo" | "icon";
};

type RegistrationCost = {
  category: string;
  participants: string;
  presale: number;
  regular: number;
};

type CartState = Record<string, number>;

const mediaPackageDetails = ["10 fotos de acción", "1 video de presentación", "2 fotos estudio"];
const mediaPackageHighlights = [
  { amount: "10", icon: Camera, label: "fotos de acción" },
  { amount: "1", icon: Video, label: "video de presentación" },
  { amount: "2", icon: Sparkles, label: "fotos estudio" },
];
const mediaPackageImages = [
  "/assets/visuals/experience-competition.jpg",
  "/assets/mvp-querida-yo-2024.jpg",
  "/assets/mvp-run-primavera-2026-veracruz.jpg",
  "/assets/mvp-instruction-primavera-2026-puebla.jpg",
];

const registrationCosts: RegistrationCost[] = [
  { category: "Solo", participants: "1 bailarín", presale: 1500, regular: 1750 },
  { category: "Dúo", participants: "2 bailarines", presale: 1300, regular: 1400 },
  { category: "Trío", participants: "3 bailarines", presale: 950, regular: 1200 },
  { category: "Grupos", participants: "4 o más bailarines", presale: 800, regular: 1000 },
];

const products: ShopProduct[] = [
  {
    id: "ticket-block",
    name: "Boleto por bloque",
    category: "Boletos",
    description: "Acceso a un bloque específico del evento.",
    price: 250,
    regularPrice: 350,
    badge: "¡¡¡Oferta!!!",
    visual: "ticket",
  },
  {
    id: "ticket-full-pass",
    name: "Full pass",
    category: "Boletos",
    description: "Acceso a todos los bloques del evento.",
    price: 600,
    badge: "Más popular",
    visual: "ticket",
  },
  {
    id: "ticket-day-pass",
    name: "Day pass",
    category: "Boletos",
    description: "Acceso por día.",
    price: 450,
    visual: "ticket",
  },
  {
    id: "photo-solos",
    name: "All inclusive solos",
    category: "Fotografía y video",
    description: "Paquete de foto y video para una participación solo.",
    price: 1000,
    badge: "Paquete destacado",
    details: mediaPackageDetails,
    image: "/assets/visuals/experience-competition.jpg",
    visual: "photo",
  },
  {
    id: "photo-duos",
    name: "All inclusive dúos",
    category: "Fotografía y video",
    description: "Precio por participante.",
    price: 700,
    visual: "icon",
  },
  {
    id: "photo-trios",
    name: "All inclusive tríos",
    category: "Fotografía y video",
    description: "Precio por participante.",
    price: 600,
    visual: "icon",
  },
  {
    id: "photo-groups",
    name: "All inclusive grupos",
    category: "Fotografía y video",
    description: "Precio por participante.",
    price: 500,
    visual: "icon",
  },
];

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 0,
  style: "currency",
});
const discountCode = "COLIBRI26";
const discountRate = 0.1;
const ticketPresaleDeadline = "10 de octubre";
const registrationPresaleDeadline = "30 de septiembre";

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function getProductIcon(productId: string) {
  if (productId.includes("duos") || productId.includes("trios") || productId.includes("groups")) {
    return <UsersRound aria-hidden="true" size={42} />;
  }

  if (productId.includes("photo")) {
    return <UserRound aria-hidden="true" size={42} />;
  }

  return <Ticket aria-hidden="true" size={42} />;
}

export function ShopPage() {
  const [cart, setCart] = useState<CartState>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeMediaImageIndex, setActiveMediaImageIndex] = useState(0);
  const [enteredDiscountCode, setEnteredDiscountCode] = useState("");
  const cartLines = useMemo(
    () =>
      products
        .map((product) => ({ product, quantity: cart[product.id] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [cart],
  );
  const cartCount = cartLines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = cartLines.reduce((total, line) => total + line.product.price * line.quantity, 0);
  const mediaSubtotal = cartLines.reduce(
    (total, line) =>
      line.product.category === "Fotografía y video" ? total + line.product.price * line.quantity : total,
    0,
  );
  const normalizedDiscountCode = enteredDiscountCode.trim().toUpperCase();
  const hasDiscountCode = normalizedDiscountCode.length > 0;
  const isDiscountCodeValid = normalizedDiscountCode === discountCode;
  const isDiscountApplied = isDiscountCodeValid && mediaSubtotal > 0;
  const discountAmount = isDiscountApplied ? Math.round(mediaSubtotal * discountRate) : 0;
  const discountMessage = !hasDiscountCode
    ? ""
    : isDiscountApplied
      ? "10% aplicado a foto y video"
      : isDiscountCodeValid
        ? "Aplica solo con paquetes de foto y video"
        : "Código no válido";
  const total = subtotal - discountAmount;
  const ticketProducts = products.filter((product) => product.category === "Boletos");
  const mediaProducts = products.filter((product) => product.category === "Fotografía y video");

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveMediaImageIndex((currentIndex) => (currentIndex + 1) % mediaPackageImages.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  const addProduct = (productId: string) => {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
    setIsCartOpen(true);
  };

  const decreaseProduct = (productId: string) => {
    setCart((current) => {
      const quantity = current[productId] ?? 0;
      if (quantity <= 1) {
        const { [productId]: _removed, ...nextCart } = current;
        return nextCart;
      }

      return { ...current, [productId]: quantity - 1 };
    });
  };

  const removeProduct = (productId: string) => {
    setCart((current) => {
      const { [productId]: _removed, ...nextCart } = current;
      return nextCart;
    });
  };

  const renderProductCard = (product: ShopProduct) => {
    const quantity = cart[product.id] ?? 0;

    return (
      <article className={`shop-product-card shop-product-card--${product.visual}`} key={product.id}>
        {product.badge ? <span className="shop-product-card__badge">{product.badge}</span> : null}

        <figure>
          {product.visual === "ticket" ? (
            <div className="shop-ticket-visual" aria-hidden="true">
              <span>Levitate MX</span>
              <strong>{product.name}</strong>
              <small>{product.description}</small>
            </div>
          ) : product.image ? (
            <img src={product.image} alt="" loading="lazy" />
          ) : (
            <div className="shop-icon-visual">{getProductIcon(product.id)}</div>
          )}
        </figure>

        <div className="shop-product-card__body">
          <div>
            <p>{product.category}</p>
            <h3>{product.name}</h3>
            <span>{product.description}</span>
            {product.details ? (
              <ul>
                {product.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="shop-product-card__buy">
            <div className="shop-product-card__price">
              {product.regularPrice ? <span>Descuento preventa</span> : null}
              <strong>{formatCurrency(product.price)}</strong>
              {product.regularPrice ? (
                <small>
                  Preventa hasta el {ticketPresaleDeadline}.{" "}
                  Normal <del>{formatCurrency(product.regularPrice)}</del>
                </small>
              ) : null}
            </div>
            <button onClick={() => addProduct(product.id)} type="button">
              <ShoppingCart aria-hidden="true" size={18} />
              {quantity > 0 ? `Añadir (${quantity})` : "Añadir al carrito"}
            </button>
          </div>
        </div>
      </article>
    );
  };

  const renderMediaPackage = () => (
    <div className="shop-media-package">
      <article className="shop-media-package__overview">
        <figure className="shop-media-stack">
          {mediaPackageImages.map((image, index) => (
            <img
              alt=""
              aria-hidden="true"
              className={`shop-media-stack__image${index === activeMediaImageIndex ? " is-active" : ""}`}
              key={image}
              loading="lazy"
              src={image}
            />
          ))}
          <span>Paquete all inclusive</span>
        </figure>
        <div>
          <p>Fotografía y video</p>
          <h3>Paquete all inclusive.</h3>
          <span>Tu cobertura oficial incluye estos entregables; solo cambia el costo por tipo de participación.</span>
          <ul>
            {mediaPackageHighlights.map((detail) => {
              const HighlightIcon = detail.icon;

              return (
                <li key={`${detail.amount}-${detail.label}`}>
                  <HighlightIcon aria-hidden="true" size={26} />
                  <strong>{detail.amount}</strong>
                  <span>{detail.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </article>

      <div className="shop-media-package__prices" aria-label="Precios de fotografía y video">
        {mediaProducts.map((product) => {
          const quantity = cart[product.id] ?? 0;
          const label = product.name.replace("All inclusive ", "");

          return (
            <article className="shop-media-price-card" key={product.id}>
              <span>{label}</span>
              <strong>{formatCurrency(product.price)}</strong>
              <p>{product.id === "photo-solos" ? "por participación" : "por participante"}</p>
              <button onClick={() => addProduct(product.id)} type="button">
                <ShoppingCart aria-hidden="true" size={18} />
                {quantity > 0 ? `Añadir (${quantity})` : "Añadir"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );

  return (
    <main className={`shop-page ${isCartOpen ? "is-cart-open" : ""}`}>
      <section className="shop-hero">
        <LevitateHeader activeLabel="Tienda" useRootLinks />

        <button
          aria-controls="shop-cart-panel"
          aria-expanded={isCartOpen}
          className="shop-cart-toggle"
          onClick={() => setIsCartOpen((current) => !current)}
          type="button"
        >
          <ShoppingCart aria-hidden="true" size={22} />
          <span>
            <small>Carrito</small>
            <strong>
              {cartCount} {cartCount === 1 ? "item" : "items"}
            </strong>
          </span>
          <b>{formatCurrency(total)}</b>
        </button>

        {isCartOpen ? (
          <button
            aria-label="Cerrar carrito"
            className="shop-cart-scrim"
            onClick={() => setIsCartOpen(false)}
            type="button"
          />
        ) : null}

        <div className="shop-hero__content">
          <section className="shop-catalog" aria-labelledby="shop-title">
            <div className="shop-catalog__heading">
              <p>Tienda Levitate</p>
              <h1 id="shop-title">
                Compra tu
                <br />
                <strong>experiencia</strong>
              </h1>
            </div>

            <section className="shop-registration" id="inscripciones" aria-labelledby="registration-title">
              <div className="shop-registration__intro">
                <div className="shop-section-number">
                  <span>01</span>
                  <i />
                </div>
                <h2 id="registration-title">Inscripción</h2>
                <p>
                  Registra tu participación en Levitate MX. El proceso inicia con el registro del titular de academia y
                  después cada participante puede consultar su subtotal con CURP.
                </p>
              </div>

              <div className="shop-registration__actions">
                <article>
                  <UserRound aria-hidden="true" size={48} />
                  <div>
                    <h3>Previo registro</h3>
                    <p>Realizado por el titular de la academia.</p>
                  </div>
                </article>
                <article>
                  <CreditCard aria-hidden="true" size={48} />
                  <div>
                    <h3>Pago asociado al CURP</h3>
                    <p>Ingresa tu CURP y consulta tu subtotal.</p>
                  </div>
                </article>
              </div>

              <div className="shop-registration__buttons">
                <a className="shop-primary-action" href="/registro">
                  Registrarse
                  <ChevronRight aria-hidden="true" size={23} />
                </a>
                <a className="shop-secondary-action" href="#consulta-curp">
                  Ya me registré
                  <ChevronRight aria-hidden="true" size={23} />
                </a>
              </div>

              <div className="shop-cost-table" aria-label="Categorías y costos de inscripción">
                <div className="shop-cost-table__head">
                  <span>Costos de inscripción</span>
                  <h3>Categorías</h3>
                  <p>
                    Precios por participante según formato. Preventa de inscripción hasta el{" "}
                    {registrationPresaleDeadline}.
                  </p>
                </div>
                <div className="shop-cost-table__grid">
                  {registrationCosts.map((cost) => (
                    <article className="shop-cost-card" key={cost.category}>
                      <div className="shop-cost-card__top">
                        <span>{cost.category}</span>
                        <small>{cost.participants}</small>
                      </div>
                      <div className="shop-cost-card__price">
                        <span>Preventa</span>
                        <strong>{formatCurrency(cost.presale)}</strong>
                        <small>Hasta el {registrationPresaleDeadline}</small>
                      </div>
                      <div className="shop-cost-card__normal">
                        <span>Normal</span>
                        <strong>{formatCurrency(cost.regular)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="shop-product-section" id="boletos" aria-labelledby="tickets-title">
              <div className="shop-product-section__head">
                <h2 id="tickets-title">Boletos</h2>
                <i />
              </div>
              <div className="shop-product-grid shop-product-grid--tickets">{ticketProducts.map(renderProductCard)}</div>
            </section>

            <section className="shop-product-section" id="foto-video" aria-labelledby="media-title">
              <div className="shop-product-section__head">
                <h2 id="media-title">Fotografía y video</h2>
                <i />
              </div>
              {renderMediaPackage()}
            </section>
          </section>

          {isCartOpen ? (
            <aside className="shop-cart" id="shop-cart-panel" aria-label="Carrito de compras">
              <div className="shop-cart__topline">
                <div className="shop-cart__header">
                  <span>
                    <ShoppingCart aria-hidden="true" size={22} />
                  </span>
                  <div>
                    <p>Carrito</p>
                    <strong>
                      {cartCount} {cartCount === 1 ? "item" : "items"}
                    </strong>
                  </div>
                </div>
                <button className="shop-cart__close" onClick={() => setIsCartOpen(false)} type="button">
                  <X aria-hidden="true" size={18} />
                  Cerrar
                </button>
              </div>

              {cartLines.length > 0 ? (
                <div className="shop-cart__lines">
                  {cartLines.map(({ product, quantity }) => (
                    <article className="shop-cart-line" key={product.id}>
                      <span className="shop-cart-line__icon">
                        {product.category === "Boletos" ? (
                          <Ticket aria-hidden="true" size={20} />
                        ) : product.id.includes("photo") ? (
                          <Camera aria-hidden="true" size={20} />
                        ) : (
                          <Video aria-hidden="true" size={20} />
                        )}
                      </span>
                      <div className="shop-cart-line__copy">
                        <strong>{product.name}</strong>
                        <span>{formatCurrency(product.price)} c/u</span>
                        <div className="shop-cart-line__controls">
                          <button aria-label={`Quitar una unidad de ${product.name}`} onClick={() => decreaseProduct(product.id)} type="button">
                            <Minus aria-hidden="true" size={16} />
                          </button>
                          <b>{quantity}</b>
                          <button aria-label={`Agregar una unidad de ${product.name}`} onClick={() => addProduct(product.id)} type="button">
                            <Plus aria-hidden="true" size={16} />
                          </button>
                          <button aria-label={`Eliminar ${product.name}`} onClick={() => removeProduct(product.id)} type="button">
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </div>
                      <strong>{formatCurrency(product.price * quantity)}</strong>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="shop-cart__empty">
                  <ShoppingBag aria-hidden="true" size={36} />
                  <strong>Carrito vacío</strong>
                  <p>Agrega boletos o paquetes de foto y video para ver tu resumen.</p>
                </div>
              )}

              <div className="shop-cart__summary">
                <label className="shop-cart__discount">
                  <span>Código de descuento</span>
                  <input
                    autoCapitalize="characters"
                    autoComplete="off"
                    onChange={(event) => setEnteredDiscountCode(event.target.value)}
                    placeholder="COLIBRI26"
                    type="text"
                    value={enteredDiscountCode}
                  />
                  <small className="shop-cart__discount-note">
                    COLIBRI26 aplica a los primeros 20 paquetes de foto y video.
                  </small>
                  {hasDiscountCode ? (
                    <small className={isDiscountApplied ? "is-valid" : ""}>
                      {discountMessage}
                    </small>
                  ) : null}
                </label>
                <div>
                  <span>Subtotal</span>
                  <strong>{formatCurrency(subtotal)}</strong>
                </div>
                {isDiscountApplied ? (
                  <div className="shop-cart__discount-row">
                    <span>Descuento COLIBRI26</span>
                    <strong>-{formatCurrency(discountAmount)}</strong>
                  </div>
                ) : null}
                <div className="shop-cart__total">
                  <span>Total</span>
                  <strong>{formatCurrency(total)}</strong>
                </div>
                <button disabled={cartCount === 0} type="button">
                  <PackageCheck aria-hidden="true" size={19} />
                  Continuar compra
                </button>
              </div>
            </aside>
          ) : null}
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
