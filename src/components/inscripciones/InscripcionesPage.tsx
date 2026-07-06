import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  Search,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type FlowStep = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type ChoreographyLine = {
  name: string;
  category: string;
  amount: number;
};

const flowSteps: FlowStep[] = [
  {
    title: "La academia registra",
    description: "El titular o responsable captura los datos del participante, su CURP y cuántas coreografías compite.",
    icon: Building2,
  },
  {
    title: "Levitate valida",
    description: "Cuando el registro queda completo, el participante ya puede consultarse para continuar con el pago.",
    icon: ShieldCheck,
  },
  {
    title: "El tutor confirma",
    description: "Madre, padre, tutor o participante mayor de edad ingresa el CURP y revisa la información registrada.",
    icon: UserRound,
  },
  {
    title: "Se genera la orden",
    description: "La orden muestra el monto, los datos bancarios oficiales y una referencia única para el concepto.",
    icon: FileText,
  },
  {
    title: "Sube comprobante",
    description: "Después de transferir, adjunta el comprobante para que Levitate pueda validar el pago.",
    icon: Upload,
  },
];

const parentChecklist = [
  "CURP del participante registrado por la academia.",
  "Nombre de la academia y responsable del registro.",
  "Lista de coreografías donde participa.",
  "Monto exacto y referencia única antes de transferir.",
];

const choreographyLines: ChoreographyLine[] = [
  { name: "Baby y Petite", category: "Motion solo", amount: 1500 },
  { name: "Junior, Teen y Senior", category: "Motion grupo", amount: 800 },
  { name: "Junior, Teen y Senior", category: "Aerial", amount: 1500 },
];

const paymentRows = [
  { label: "Beneficiario", value: "Levitate MX" },
  { label: "Banco", value: "Datos oficiales al generar orden" },
  { label: "CLABE", value: "Visible en la orden final" },
  { label: "Concepto", value: "LEV-EDOMEX-LOPA-2419" },
];

const receiptChecklist = [
  "Sube el comprobante después de hacer la transferencia.",
  "El concepto debe coincidir con la referencia única de tu orden.",
  "Acepta PDF, JPG o PNG con imagen legible.",
];

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 0,
  style: "currency",
});

const subtotal = choreographyLines.reduce((total, line) => total + line.amount, 0);

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

export function InscripcionesPage() {
  const [receiptFileName, setReceiptFileName] = useState("");

  const handleReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
    setReceiptFileName(event.target.files?.[0]?.name ?? "");
  };

  return (
    <main className="levitate-home-redesign inscripciones-page">
      <section className="inscripciones-hero" id="inicio">
        <div className="inscripciones-hero__backdrop" aria-hidden="true">
          <video autoPlay muted loop playsInline preload="metadata">
            <source src="/assets/levitate-home-hero.mp4" type="video/mp4" />
          </video>
        </div>
        <LevitateHeader activeLabel="Inscripciones" useRootLinks variant="pill" />

        <div className="inscripciones-hero__content">
          <div className="inscripciones-hero__copy">
            <p className="inscripciones-eyebrow">Inscripciones</p>
            <h1>
              Inscripción
              <strong>paso a paso</strong>
            </h1>
            <p>
              Primero la academia registra al participante. Después el padre, tutor o participante mayor de edad
              consulta su CURP, revisa sus coreografías y genera la orden para pagar por transferencia.
            </p>
            <div className="inscripciones-hero__actions">
              <a className="inscripciones-button inscripciones-button--light" href="/registro">
                Soy academia
                <ArrowRight aria-hidden="true" size={18} />
              </a>
              <a className="inscripciones-button inscripciones-button--dark" href="#consulta-curp">
                Consultar CURP
                <Search aria-hidden="true" size={18} />
              </a>
            </div>
          </div>

          <aside className="inscripciones-hero__summary" aria-label="Resumen del flujo de pago">
            <span>Pago obligatorio</span>
            <h2>El pago se hace después del registro de academia.</h2>
            <div>
              <p>
                La familia no captura coreografías desde cero: confirma lo que la academia ya registró y paga con una
                referencia personalizada.
              </p>
              <strong>{formatCurrency(subtotal)} MXN</strong>
            </div>
          </aside>
        </div>
      </section>

      <section className="inscripciones-flow" aria-labelledby="inscripciones-flow-title">
        <div className="inscripciones-section-head">
          <p className="inscripciones-eyebrow">Cómo funciona</p>
          <h2 id="inscripciones-flow-title">Un proceso claro para cada familia.</h2>
        </div>

        <div className="inscripciones-step-grid">
          {flowSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <article className="inscripciones-step-card" key={step.title}>
                <div>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon aria-hidden="true" size={28} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="inscripciones-parent-band">
        <div className="inscripciones-parent-band__copy">
          <p className="inscripciones-eyebrow">Para padres y tutores</p>
          <h2>Antes de transferir, confirma todo.</h2>
          <p>
            Esta página está pensada para quien realiza el pago. El objetivo es que puedas verificar el registro,
            entender el subtotal y usar exactamente la referencia indicada en la orden.
          </p>
        </div>

        <div className="inscripciones-checklist" aria-label="Información necesaria para pagar">
          {parentChecklist.map((item) => (
            <article key={item}>
              <CheckCircle2 aria-hidden="true" size={22} />
              <span>{item}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="inscripciones-query" id="consulta-curp" aria-labelledby="consulta-curp-title">
        <div className="inscripciones-section-head inscripciones-section-head--light">
          <p className="inscripciones-eyebrow">Consulta por CURP</p>
          <h2 id="consulta-curp-title">Así se verá la confirmación antes de pagar.</h2>
        </div>

        <div className="inscripciones-payment-grid">
          <article className="inscripciones-curp-card">
            <div className="inscripciones-card-icon">
              <Search aria-hidden="true" size={26} />
            </div>
            <label htmlFor="curp-preview">CURP del participante</label>
            <div className="inscripciones-curp-card__input">
              <input id="curp-preview" readOnly value="LOPA100212MDFRLR04" />
            </div>
            <p>Al consultar, el sistema debe mostrar los datos registrados por la academia.</p>
          </article>

          <article className="inscripciones-confirmation-card">
            <header>
              <div className="inscripciones-card-icon">
                <CheckCircle2 aria-hidden="true" size={26} />
              </div>
              <div>
                <span>Registro encontrado</span>
                <h3>Lucía Paredes</h3>
                <p>Academia Elevate Studio</p>
              </div>
            </header>

            <div className="inscripciones-choreography-list" aria-label="Coreografías y costos registrados">
              {choreographyLines.map((line) => (
                <div className="inscripciones-choreography-row" key={`${line.category}-${line.name}`}>
                  <div>
                    <strong>{line.name}</strong>
                    <span>{line.category}</span>
                  </div>
                  <b>{formatCurrency(line.amount)}</b>
                </div>
              ))}
            </div>

            <div className="inscripciones-subtotal">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
          </article>

          <article className="inscripciones-order-card" aria-labelledby="payment-order-title">
            <header>
              <div className="inscripciones-card-icon">
                <Landmark aria-hidden="true" size={26} />
              </div>
              <div>
                <span>Orden de pago</span>
                <h3 id="payment-order-title">Transferencia bancaria</h3>
              </div>
            </header>

            <dl>
              {paymentRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="inscripciones-order-card__total">
              <span>Monto exacto</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>

            <p>
              La referencia debe escribirse como concepto de pago para poder identificar la transferencia sin
              aclaraciones extra.
            </p>

            <button type="button">
              Generar orden de pago
              <CreditCard aria-hidden="true" size={18} />
            </button>
          </article>
        </div>

        <div className="inscripciones-upload-panel" aria-labelledby="payment-receipt-title">
          <div className="inscripciones-upload-panel__copy">
            <p className="inscripciones-eyebrow">Después de transferir</p>
            <h3 id="payment-receipt-title">Sube tu comprobante de pago.</h3>
            <p>
              Una vez hecha la transferencia, adjunta el comprobante en esta misma sección para que el equipo pueda
              validar el pago contra la referencia de tu orden.
            </p>

            <div className="inscripciones-upload-checks" aria-label="Requisitos del comprobante">
              {receiptChecklist.map((item) => (
                <span key={item}>
                  <CheckCircle2 aria-hidden="true" size={18} />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="inscripciones-upload-card">
            <label className="inscripciones-upload-dropzone" htmlFor="payment-receipt">
              <Upload aria-hidden="true" size={32} />
              <strong>{receiptFileName || "Seleccionar comprobante"}</strong>
              <span>{receiptFileName ? "Archivo listo para validación" : "PDF, JPG o PNG"}</span>
              <input
                accept="application/pdf,image/jpeg,image/png"
                id="payment-receipt"
                onChange={handleReceiptChange}
                type="file"
              />
            </label>

            <button disabled={!receiptFileName} type="button">
              Enviar comprobante
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
