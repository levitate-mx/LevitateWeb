# Ventas y accesos por bloque

La ocupación por ventas indica cuántos lugares se compraron. El contador de QR
representa accesos atribuidos a los bloques según los pases canjeados. Ninguno
representa butacas físicamente ocupadas: las pulseras permiten volver a entrar
sin escanear y no se registran salidas.

## Reglas

- Cada boleto individual suma al aceptarse su QR por primera vez.
- Single pass: suma uno al bloque comprado.
- Day pass del sábado: suma uno a cada bloque del 1 al 4.
- Day pass del domingo: suma uno a cada bloque del 5 al 7.
- Full pass: suma uno a cada uno de los siete bloques.
- Un QR repetido, rechazado, impago, cancelado o presentado en un bloque/día
  incompatible no suma. Un Full pass representa un solo QR único, aunque sume en
  siete bloques. No sumar los totales de bloques para obtener personas únicas.

El catálogo de evento, días y bloques se comparte entre la tienda y el servidor en
`shared/ticket-event.json`. Para otra edición debe usarse un nuevo `eventId`;
no se debe reutilizar el identificador de un evento finalizado.

## Persistencia

Cloudflare D1 guarda:

- `registration_ticket_admissions`: registro del primer ingreso, boleto, evento,
  tipo de pase, día, bloque elegido en el escáner, dispositivo/operador, hora y
  bloques a los que se atribuyó el acceso.
- `registration_attendance_events`: nombre y catálogo histórico del evento, y
  cantidad de QR únicos canjeados.
- `registration_attendance_blocks`: total y desglose Single/Day/Full por bloque.

El canje, el ingreso y los contadores se escriben en una misma transacción D1.
La restricción única por evento y boleto evita duplicados entre dispositivos y
reintentos. El resumen consulta contadores agregados, sin recorrer todas las
órdenes ni reconstruir los ingresos en cada actualización.

El historial se conserva si después se elimina una orden o se cambia su pago.
Los registros no guardan nombres, CURP ni contactos de compradores. Los boletos
usados antes de esta funcionalidad no se vuelven a admitir ni se convierten en
ingresos históricos inventados. Un Day pass antiguo sin día definido requiere
corrección administrativa antes de admitirse.

## Consulta y aplicación

`GET /api/registration/scanner/attendance` requiere la sesión del dispositivo.
`GET /api/registration/admin/attendance` requiere administración global.
Ambos aceptan `eventId` opcional para consultar un evento anterior y devuelven un
objeto `attendance` con el total de QR únicos, los bloques, su desglose y eventos
disponibles. El endpoint de escaneo también devuelve el resumen cuando está
disponible.

Levitate Entrada muestra el resumen global del bloque seleccionado y permite
consultar los demás bloques e históricos. Actualiza al abrir, regresar a la app,
cambiar de bloque, escanear y pulsar Actualizar. Mientras está en primer plano
sincroniza cada 30 segundos; en segundo plano detiene esa sincronización.
Si falla la consulta conserva el último dato y avisa que está pendiente de
actualizar, sin confundirlo con un cero ni modificar la decisión de un QR.

## Ocupación por ventas

En administración (Inicio y Boletos) y Android se muestra **vendidos / 500** y
su porcentaje, con desglose Single/Day/Full. Se cuentan los boletos activos o
canjeados de compras con pago aprobado, aunque el comprador todavía no haya
ingresado. Day y Full se atribuyen a los mismos bloques que sus accesos. Escanear
un boleto no vuelve a sumarlo a las ventas. Las compras pendientes, rechazadas,
eliminadas y los boletos cancelados se excluyen del cálculo; corregir una compra
puede bajar el total vendido sin borrar el historial de ingresos.

La capacidad por bloque se configura en `shared/ticket-event.json`. Es una
referencia visual, no una restricción nueva de venta o admisión. Si las ventas
superan la capacidad, se muestra el porcentaje real y una advertencia; sólo la
barra visual se limita al 100 %. Los boletos sin bloque/día asignable se informan
aparte para revisión, sin inventar su cobertura.

`GET /api/registration/admin/ticket-sales-summary` y
`GET /api/registration/scanner/ticket-sales-summary` requieren la misma
autenticación que los resúmenes de asistencia y aceptan `eventId` opcional.
El objeto `sales` contiene los totales de compras y la capacidad. Estas consultas
no escriben en la base ni recorren otros eventos.

Ventas se consulta al abrir la vista y con **Actualizar**; Android también al
volver a primer plano. No se consulta por cada QR ni en el sondeo periódico de
asistencia. Su fecha y sus errores se muestran por separado del contador de
ingresos. Los filtros de compras del administrador no modifican el resumen del
evento. Ante un error se conserva el último dato disponible con su fecha.

## Publicación

1. Ejecutar las pruebas de registro, compilar la web y probar/compilar Android.
2. Ejecutar `npm run db:prepare:registration` antes de publicar el Worker. La
   preparación añade el identificador de evento a los boletos existentes y las
   tres tablas; no reinicia ni consume boletos.
3. Publicar el Worker y verificar que los endpoints exigen autenticación.
4. Distribuir el APK con la misma firma e identificador que la instalación
   existente. Instalar como actualización, sin desinstalar ni borrar los datos,
   para conservar la vinculación del teléfono.

La instalación por primera vez sigue requiriendo el proceso de vinculación del
escáner. Una actualización no debe generar ni reemplazar credenciales.
