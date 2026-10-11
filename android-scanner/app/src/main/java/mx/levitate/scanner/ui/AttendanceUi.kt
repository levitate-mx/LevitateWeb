package mx.levitate.scanner.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import mx.levitate.scanner.model.AttendanceEvent
import mx.levitate.scanner.model.AttendanceState
import mx.levitate.scanner.model.BlockTicketSales
import mx.levitate.scanner.model.TicketSalesCapacity
import mx.levitate.scanner.model.TicketSalesState

@Composable
internal fun AttendancePanel(
    state: AttendanceState,
    salesState: TicketSalesState,
    blockId: String?,
    canOpenHistory: Boolean,
    onRefresh: () -> Unit,
    onHistory: () -> Unit,
) {
    val sales = salesState.snapshotForEvent(state.snapshot?.eventId)
    val salesEventMismatch = salesState.snapshot != null && sales == null
    val sold = sales?.blocks?.firstOrNull { it.id == blockId }
    val scanned = state.snapshot?.blocks?.firstOrNull { it.id == blockId }
    Column(
        modifier = Modifier.fillMaxWidth().background(Color.Black.copy(alpha = 0.88f))
            .padding(horizontal = 18.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text("Boletos comprados", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        sales?.let { Text(it.eventName, color = Color(0xFFBDBDBD), fontSize = 11.sp) }
        if (sold != null) {
            SalesFigures(sold, sales.capacityPerBlock, dark = true)
        } else {
            Text(if (salesState.isLoading) "Cargando ventas…" else "Ventas no disponibles —",
                color = Color.White, fontSize = 14.sp)
        }
        if (salesEventMismatch) {
            Text("Ventas de otro evento; toca Actualizar para consultar.", color = Color(0xFFFFC66D), fontSize = 11.sp)
        } else TicketSalesFreshness(salesState, dark = true)
        if (sales != null && sales.unassignedTickets > 0) {
            Text("${sales.unassignedTickets} vendidos sin bloque asignado.", color = Color(0xFFFFC66D), fontSize = 11.sp)
        }
        HorizontalDivider(Modifier.padding(vertical = 4.dp), color = Color.White.copy(alpha = 0.2f))
        Text("QR canjeados atribuidos: ${scanned?.total ?: "—"}", color = Color.White, fontSize = 12.sp)
        AttendanceFreshness(state, dark = true)
        Text("Estimado por pases; no mide butacas ocupadas.", color = Color(0xFFBDBDBD), fontSize = 11.sp)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = onRefresh, enabled = !state.isLoading && !salesState.isLoading) {
                Text("ACTUALIZAR", color = LevitatePink, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            TextButton(onClick = onHistory, enabled = canOpenHistory) {
                Text("VER BLOQUES / HISTORIAL", color = if (canOpenHistory) Color.White else Color.Gray,
                    fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
internal fun AttendanceHistoryDialog(
    state: AttendanceState,
    salesState: TicketSalesState,
    selectedEventId: String?,
    availableEvents: List<AttendanceEvent>,
    onSelectEvent: (String) -> Unit,
    onRefresh: () -> Unit,
    onDismiss: () -> Unit,
) {
    var showEvents by remember { mutableStateOf(false) }
    val snapshot = state.snapshot?.takeIf { selectedEventId == null || it.eventId == selectedEventId }
    val sales = salesState.snapshotForEvent(selectedEventId)
    val events = (availableEvents + snapshot?.events.orEmpty() + listOfNotNull(
        sales?.let { AttendanceEvent(it.eventId, it.eventName) },
    )).distinctBy { it.id }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Bloques e historial") },
        text = {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (events.size > 1) {
                    Column {
                        OutlinedButton(onClick = { showEvents = true }, modifier = Modifier.fillMaxWidth()) {
                            Text(events.firstOrNull { it.id == selectedEventId }?.name ?: "Elegir evento")
                        }
                        DropdownMenu(expanded = showEvents, onDismissRequest = { showEvents = false }) {
                            events.forEach { event ->
                                DropdownMenuItem(
                                    text = { Text(event.name) },
                                    onClick = { showEvents = false; onSelectEvent(event.id) },
                                )
                            }
                        }
                    }
                } else {
                    Text(sales?.eventName ?: snapshot?.eventName ?: events.firstOrNull()?.name ?: "Evento", fontWeight = FontWeight.Bold)
                }
                Text("Boletos comprados por bloque", fontWeight = FontWeight.Bold)
                TicketSalesFreshness(salesState)
                Text(sales?.let { "Boletos únicos vendidos: ${it.uniqueTickets}" } ?: "Ventas no disponibles —", fontSize = 12.sp)
                if (sales != null && sales.unassignedTickets > 0) {
                    Text("${sales.unassignedTickets} vendidos sin bloque asignado.", color = Color(0xFF885300), fontSize = 12.sp)
                }
                HorizontalDivider(color = Color.Gray.copy(alpha = 0.25f))
                AttendanceFreshness(state)
                Text(snapshot?.let { "QR únicos canjeados: ${it.uniqueAdmissions}" } ?: "QR canjeados no disponibles —", fontSize = 12.sp)
                if (snapshot == null && sales == null) {
                    Text(if (state.isLoading || salesState.isLoading) "Cargando resúmenes…" else "Los resúmenes todavía no están disponibles.")
                } else {
                    Text("Single cuenta en su bloque; Day en los bloques de su día; Full en todo el evento. Sumar los bloques no equivale a personas únicas.", fontSize = 12.sp)
                    val blocks = sales?.blocks?.map { HistoryBlock(it.id, it.label, it.date) }
                        ?: snapshot?.blocks.orEmpty().map { HistoryBlock(it.id, it.label, it.date) }
                    blocks.forEach { block ->
                        val sold = sales?.blocks?.firstOrNull { it.id == block.id }
                        val scanned = snapshot?.blocks?.firstOrNull { it.id == block.id }
                        Column(
                            Modifier.fillMaxWidth().background(Color.Gray.copy(alpha = 0.1f)).padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text(block.label, fontWeight = FontWeight.Bold)
                            Text(block.date, fontSize = 12.sp)
                            if (sold != null) SalesFigures(sold, sales.capacityPerBlock)
                            else Text("Ventas no disponibles —", fontSize = 12.sp)
                            HorizontalDivider(Modifier.padding(vertical = 3.dp), color = Color.Gray.copy(alpha = 0.25f))
                            Text("QR canjeados atribuidos: ${scanned?.total ?: "—"}", fontSize = 12.sp)
                        }
                    }
                    Text("Ventas: consulta al abrir o Actualizar. QR canjeados: historial del servidor, compartido por todos los teléfonos. No mide ocupación física.", fontSize = 12.sp)
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("VOLVER AL ESCÁNER") } },
        dismissButton = { TextButton(onClick = onRefresh, enabled = !state.isLoading && !salesState.isLoading) { Text("ACTUALIZAR") } },
    )
}

private data class HistoryBlock(val id: String, val label: String, val date: String)

@Composable
private fun SalesFigures(block: BlockTicketSales, capacity: Long, dark: Boolean = false) {
    val usage = TicketSalesCapacity(block.total, capacity)
    val textColor = if (dark) Color.White else Color.DarkGray
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text("${block.total}/$capacity vendidos", color = textColor, fontSize = 20.sp,
            fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        Text(usage.percentageLabel, color = if (dark) LevitatePink else Color(0xFFB92E6C),
            fontWeight = FontWeight.Bold, fontSize = 15.sp)
    }
    LinearProgressIndicator(progress = { usage.progress }, modifier = Modifier.fillMaxWidth().height(5.dp),
        color = LevitatePink, trackColor = Color.Gray.copy(alpha = 0.25f))
    Text("Compras: Single ${block.single} · Day ${block.day} · Full ${block.full}", color = textColor, fontSize = 11.sp)
    if (usage.exceedsCapacity) {
        Text("Supera la capacidad en ${block.total - capacity} boletos.",
            color = if (dark) Color(0xFFFFC66D) else Color(0xFF885300), fontSize = 11.sp)
    }
}

@Composable
private fun TicketSalesFreshness(state: TicketSalesState, dark: Boolean = false) {
    val time = state.checkedAtMillis?.let(::summaryTime)
    val text = when {
        state.error != null -> "Ventas: ${state.error}" + (time?.let { " Último dato: $it CDMX." } ?: "")
        state.isLoading -> if (time == null) "Ventas: consultando…" else "Ventas: consultando · último dato $time CDMX"
        state.isStale -> time?.let { "Ventas sin actualizar · último dato $it CDMX" } ?: "Ventas sin datos confirmados."
        else -> "Ventas · última consulta $time CDMX"
    }
    Text(text, color = if (state.isStale) { if (dark) Color(0xFFFFC66D) else Color(0xFF885300) }
        else if (dark) Color(0xFFBDBDBD) else Color.DarkGray, fontSize = 11.sp)
}

private fun summaryTime(value: Long): String = SimpleDateFormat("dd/MM HH:mm:ss", Locale.forLanguageTag("es-MX")).apply {
    timeZone = TimeZone.getTimeZone("America/Mexico_City")
}.format(Date(value))

@Composable
private fun AttendanceFreshness(state: AttendanceState, dark: Boolean = false) {
    val checkedAt = state.checkedAtMillis
    val stale = state.isStale || checkedAt == null || System.currentTimeMillis() - checkedAt > 90_000
    val time = checkedAt?.let(::summaryTime)
    val text = when {
        state.error != null -> state.error + (time?.let { " Último dato: $it CDMX." } ?: "")
        state.isLoading -> if (time == null) "Sincronizando…" else "Sincronizando · último dato $time CDMX"
        stale -> time?.let { "Sin actualizar · último dato $it CDMX" } ?: "Sin datos confirmados."
        else -> "Actualizado $time CDMX"
    }
    Text("QR: $text", color = if (stale) { if (dark) Color(0xFFFFC66D) else Color(0xFF885300) }
        else if (dark) Color(0xFFBDBDBD) else Color.DarkGray, fontSize = 11.sp)
}
