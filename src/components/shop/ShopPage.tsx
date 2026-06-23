import {
  Camera,
  ChevronRight,
  CreditCard,
  Minus,
  PackageCheck,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Ticket,
  Trash2,
  UserRound,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type ShopProduct = {
  id: string;
  name: string;
  category: "Boletos" | "Fotografía y video";
  description: string;
  price: number;
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
    price: 350,
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
  const cartLines = useMemo(
    () =>
      products
        .map((product) => ({ product, quantity: cart[product.id] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [cart],
  );
  const cartCount = cartLines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = cartLines.reduce((total, line) => total + line.product.price * line.quantity, 0);
  const ticketProducts = products.filter((product) => product.category === "Boletos");
  const mediaProducts = products.filter((product) => product.category === "Fotografía y video");

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
            <strong>{formatCurrency(product.price)}</strong>
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
        <figure>
          <img src="/assets/visuals/experience-competition.jpg" alt="" loading="lazy" />
          <span>Paquete all inclusive</span>
        </figure>
        <div>
          <p>Fotografía y video</p>
          <h3>Un paquete. Cuatro formatos.</h3>
          <span>Todos los formatos incluyen la misma cobertura; solo cambia el costo por tipo de participación.</span>
          <ul>
            {mediaPackageDetails.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
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
          <b>{formatCurrency(subtotal)}</b>
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
              <span>Inscripciones, accesos y cobertura oficial reunidos en un solo lugar.</span>
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
                  <p>Precios por participante según formato. Preventa disponible por tiempo limitado.</p>
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
                <div>
                  <span>Subtotal</span>
                  <strong>{formatCurrency(subtotal)}</strong>
                </div>
                <div>
                  <span>Inscripción</span>
                  <strong>Por CURP</strong>
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
