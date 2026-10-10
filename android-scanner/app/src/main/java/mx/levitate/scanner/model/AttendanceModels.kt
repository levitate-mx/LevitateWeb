package mx.levitate.scanner.model

import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

data class AttendanceEvent(val id: String, val name: String)

data class BlockAttendance(
    val id: String,
    val label: String,
    val dayId: String,
    val date: String,
    val total: Long,
    val single: Long,
    val day: Long,
    val full: Long,
) {
    init {
        require(id.isNotBlank() && label.isNotBlank() && dayId.isNotBlank() && date.isNotBlank())
        require(total >= 0 && single >= 0 && day >= 0 && full >= 0)
        require(single <= total && day <= total - single && full == total - single - day)
    }
}

data class AttendanceSnapshot(
    val eventId: String,
    val eventName: String,
    val venue: String,
    val updatedAt: String,
    val uniqueAdmissions: Long,
    val blocks: List<BlockAttendance>,
    val events: List<AttendanceEvent>,
) {
    val updatedAtMillis: Long = parseAttendanceTimestamp(updatedAt)
        ?: throw IllegalArgumentException("La fecha del resumen no es válida.")

    init {
        require(eventId.isNotBlank() && eventName.isNotBlank() && venue.isNotBlank())
        require(uniqueAdmissions >= 0 && blocks.isNotEmpty())
        require(blocks.map { it.id }.distinct().size == blocks.size)
        require(blocks.all { it.total <= uniqueAdmissions })
        require(events.all { it.id.isNotBlank() && it.name.isNotBlank() })
        require(events.map { it.id }.distinct().size == events.size)
    }
}

/** Totals are server snapshots. A failed refresh never becomes a zero count. */
data class AttendanceState(
    val snapshot: AttendanceSnapshot? = null,
    val isLoading: Boolean = false,
    val isStale: Boolean = true,
    val error: String? = null,
    val checkedAtMillis: Long? = null,
) {
    fun receive(next: AttendanceSnapshot, checkedAt: Long, expectedEventId: String? = null): AttendanceState {
        if (expectedEventId != null && next.eventId != expectedEventId) {
            return failed("El resumen recibido corresponde a otro evento. Actualiza para reintentar.")
        }
        val previous = snapshot?.takeIf { it.eventId == next.eventId }
        // A GET can finish after a scan while having read older data. Admission
        // history is append-only: neither its unique total nor its timestamp may go backwards.
        if (previous != null && (next.updatedAtMillis < previous.updatedAtMillis ||
                next.uniqueAdmissions < previous.uniqueAdmissions)) {
            return copy(isLoading = false)
        }
        return AttendanceState(next, isLoading = false, isStale = false, checkedAtMillis = checkedAt)
    }

    fun failed(message: String) = copy(isLoading = false, isStale = true, error = message)
}

fun parseAttendanceTimestamp(value: String): Long? {
    for (pattern in listOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'")) {
        val format = SimpleDateFormat(pattern, Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
            isLenient = false
        }
        val position = ParsePosition(0)
        val date = format.parse(value, position)
        if (date != null && position.index == value.length) return date.time
    }
    return null
}
