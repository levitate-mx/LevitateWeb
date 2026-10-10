package mx.levitate.scanner.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
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

@Composable
internal fun AttendancePanel(
    state: AttendanceState,
    blockId: String?,
    canOpenHistory: Boolean,
    onRefresh: () -> Unit,
    onHistory: () -> Unit,
) {
    val block = state.snapshot?.blocks?.firstOrNull { it.id == blockId }
    Column(
        modifier = Modifier.fillMaxWidth().background(Color.Black.copy(alpha = 0.88f))
            .padding(horizontal = 18.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Accesos contabilizados", color = Color.White, fontWeight = FontWeight.Bold,
                fontSize = 15.sp, modifier = Modifier.weight(1f))
            Text(block?.total?.toString() ?: "—", color = LevitatePink, fontSize = 27.sp,
                fontWeight = FontWeight.Black)
        }
        Text(
            block?.let { "Single ${it.single} · Day ${it.day} · Full ${it.full}" }
                ?: if (blockId == null) "Selecciona el bloque para ver sus accesos."
                else if (state.isLoading) "Cargando resumen…" else "Resumen no disponible.",
            color = Color.White, fontSize = 12.sp,
        )
        Text("Estimado por pases; no mide butacas ocupadas.", color = Color(0xFFBDBDBD), fontSize = 11.sp)
        AttendanceFreshness(state, dark = true)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = onRefresh, enabled = !state.isLoading) {
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
    selectedEventId: String?,
    availableEvents: List<AttendanceEvent>,
    onSelectEvent: (String) -> Unit,
    onRefresh: () -> Unit,
    onDismiss: () -> Unit,
) {
    var showEvents by remember { mutableStateOf(false) }
    val snapshot = state.snapshot
    val events = (availableEvents + snapshot?.events.orEmpty()).distinctBy { it.id }
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
                    Text(snapshot?.eventName ?: events.firstOrNull()?.name ?: "Evento", fontWeight = FontWeight.Bold)
                }
                AttendanceFreshness(state)
                if (snapshot == null) {
                    Text(if (state.isLoading) "Cargando accesos…" else "El resumen todavía no está disponible.")
                } else {
                    Text("QR únicos canjeados: ${snapshot.uniqueAdmissions}", fontWeight = FontWeight.Bold)
                    Text("Single cuenta en su bloque; Day en los bloques de su día; Full en todo el evento. Un pase puede aparecer en varios bloques.", fontSize = 12.sp)
                    snapshot.blocks.forEach { block ->
                        Column(
                            Modifier.fillMaxWidth().background(Color.Gray.copy(alpha = 0.1f)).padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(block.label, fontWeight = FontWeight.Bold)
                                Text(block.total.toString(), fontWeight = FontWeight.Black)
                            }
                            Text(block.date, fontSize = 12.sp)
                            Text("Single ${block.single} · Day ${block.day} · Full ${block.full}", fontSize = 12.sp)
                        }
                    }
                    Text("Historial guardado en el servidor, compartido por todos los teléfonos. Estimado por pases; no mide ocupación física.", fontSize = 12.sp)
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("VOLVER AL ESCÁNER") } },
        dismissButton = { TextButton(onClick = onRefresh, enabled = !state.isLoading) { Text("ACTUALIZAR") } },
    )
}

@Composable
private fun AttendanceFreshness(state: AttendanceState, dark: Boolean = false) {
    val checkedAt = state.checkedAtMillis
    val stale = state.isStale || checkedAt == null || System.currentTimeMillis() - checkedAt > 90_000
    val time = checkedAt?.let {
        SimpleDateFormat("dd/MM HH:mm:ss", Locale.forLanguageTag("es-MX")).apply {
            timeZone = TimeZone.getTimeZone("America/Mexico_City")
        }.format(Date(it))
    }
    val text = when {
        state.error != null -> state.error + (time?.let { " Último dato: $it CDMX." } ?: "")
        state.isLoading -> if (time == null) "Sincronizando…" else "Sincronizando · último dato $time CDMX"
        stale -> time?.let { "Sin actualizar · último dato $it CDMX" } ?: "Sin datos confirmados."
        else -> "Actualizado $time CDMX"
    }
    Text(text, color = if (stale) { if (dark) Color(0xFFFFC66D) else Color(0xFF885300) }
        else if (dark) Color(0xFFBDBDBD) else Color.DarkGray, fontSize = 11.sp)
}
