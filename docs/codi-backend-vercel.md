# Backend CoDi en Vercel

Esta base agrega Vercel Functions para manejar el flujo de CoDi/SPEI con proveedor:

- Crear intento de pago CoDi.
- Consultar estado de orden.
- Recibir webhook del proveedor.
- Cancelar intentos pendientes.
- Persistir ordenes, intentos y eventos en Postgres.

## Endpoints

| Endpoint | Metodo | Uso |
|---|---|---|
| `/api/health` | GET | Verifica conexion a base. |
| `/api/pay/codi` | POST | Crea orden/intento y devuelve QR/link mock. |
| `/api/order/status?orderId=...` | GET | Devuelve estado de orden e intentos. |
| `/api/order/cancel` | POST | Expira intentos pendientes de una orden. |
| `/api/webhook/codi` | POST | Recibe eventos del proveedor. |

## Variables de entorno

```env
DATABASE_URL="postgres://user:password@host/database?sslmode=require"
CODI_PROVIDER="mock"
CODI_WEBHOOK_SECRET="change-me"
PUBLIC_SITE_URL="https://tu-dominio.com"
```

En Vercel, la base recomendada para esta etapa es Postgres desde Marketplace, por ejemplo Neon. Vercel inyecta las credenciales como variables de entorno del proyecto.

## Migracion

Con `DATABASE_URL` cargada en `.env.local`, ejecutar:

```bash
npm run db:migrate:codi
```

## Probar en modo mock

Crear pago:

```bash
curl -X POST http://localhost:3000/api/pay/codi \
  -H "content-type: application/json" \
  -d '{
    "amount": 1000,
    "description": "Inscripcion Levitate",
    "customer": { "email": "cliente@example.com", "phone": "5512345678" }
  }'
```

Simular webhook pagado:

```bash
curl -X POST http://localhost:3000/api/webhook/codi \
  -H "content-type: application/json" \
  -H "x-codi-webhook-secret: change-me" \
  -d '{
    "provider": "mock",
    "paymentAttemptId": "PAYMENT_ATTEMPT_ID",
    "status": "paid",
    "amount": 1000
  }'
```

## Siguiente paso

Cuando el proveedor confirme documentacion real, se reemplaza el adapter `mock` en `api/_lib/codi-provider.js` por el adapter de BBVA, STP o quien corresponda. La base de datos y los endpoints pueden mantenerse iguales.
