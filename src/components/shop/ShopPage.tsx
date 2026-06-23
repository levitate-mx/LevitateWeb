import { Minus, PackageCheck, Plus, ShoppingBag, ShoppingCart, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type ShopProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
};

type CartState = Record<string, number>;

const products: ShopProduct[] = [
  {
    id: "hoodie",
    name: "Hoodie Levitate",
    category: "Merch",
    description: "Sudadera genérica para entrenamientos, viajes y backstage.",
    price: 890,
    image: "/assets/visuals/hero-stage.jpg",
  },
  {
    id: "tote",
    name: "Tote bag",
    category: "Accesorios",
    description: "Bolsa ligera para básicos de competencia y clases.",
    price: 320,
    image: "/assets/premiation-recognition-special.jpg",
  },
  {
    id: "bottle",
    name: "Termo escénico",
    category: "Accesorios",
    description: "Termo de uso diario con acabado negro y detalle rosa.",
    price: 420,
    image: "/assets/visuals/experience-workshops.jpg",
  },
  {
    id: "ticket",
    name: "Boleto general",
    category: "Evento",
    description: "Entrada genérica de prueba para una jornada Levitate.",
    price: 250,
    image: "/assets/visuals/venue-stage.jpg",
  },
  {
    id: "pack",
    name: "Kit participante",
    category: "Competencia",
    description: "Paquete base con artículos genéricos para participantes.",
    price: 640,
    image: "/assets/medallero-oro.png",
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
                Tienda <strong>oficial</strong>
              </h1>
              <span>Productos genéricos para maqueta inicial.</span>
            </div>

            <div className="shop-product-grid">
              {products.map((product) => {
                const quantity = cart[product.id] ?? 0;

                return (
                  <article className="shop-product-card" key={product.id}>
                    <figure>
                      <img src={product.image} alt="" loading="lazy" />
                      <span>{product.category}</span>
                    </figure>
                    <div className="shop-product-card__body">
                      <div>
                        <h2>{product.name}</h2>
                        <p>{product.description}</p>
                      </div>
                      <div className="shop-product-card__buy">
                        <strong>{formatCurrency(product.price)}</strong>
                        <button onClick={() => addProduct(product.id)} type="button">
                          <Plus aria-hidden="true" size={18} />
                          {quantity > 0 ? `Agregar (${quantity})` : "Agregar"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
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
                      <img src={product.image} alt="" loading="lazy" />
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
                  <p>Agrega productos para ver el resumen de compra.</p>
                </div>
              )}

              <div className="shop-cart__summary">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatCurrency(subtotal)}</strong>
                </div>
                <div>
                  <span>Envío</span>
                  <strong>{cartCount > 0 ? "Por definir" : "$0"}</strong>
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
