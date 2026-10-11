package mx.levitate.scanner.model

import java.text.NumberFormat
import java.util.Locale

data class BlockTicketSales(
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

data class TicketSalesSnapshot(
    val eventId: String,
    val eventName: String,
    val venue: String,
    val updatedAt: String,
    val capacityPerBlock: Long,
    val uniqueTickets: Long,
    val unassignedTickets: Long,
    val blocks: List<BlockTicketSales>,
) {
    val updatedAtMillis: Long = parseAttendanceTimestamp(updatedAt)
        ?: throw IllegalArgumentException("La fecha de ventas no es válida.")

    init {
        require(eventId.isNotBlank() && eventName.isNotBlank() && venue.isNotBlank())
        require(capacityPerBlock > 0 && uniqueTickets >= 0 && unassignedTickets >= 0)
        require(blocks.isNotEmpty() && blocks.map { it.id }.distinct().size == blocks.size)
    }
}

data class TicketSalesCapacity(val sold: Long, val capacity: Long) {
    init { require(sold >= 0 && capacity > 0) }
    val percentage: Double get() = sold.toDouble() / capacity * 100
    val progress: Float get() = (sold.toDouble() / capacity).coerceIn(0.0, 1.0).toFloat()
    val exceedsCapacity: Boolean get() = sold > capacity
    val percentageLabel: String get() = NumberFormat.getNumberInstance(Locale.forLanguageTag("es-MX")).apply {
        maximumFractionDigits = 1
    }.format(percentage) + "%"
}

/** Sales can decrease after cancellations. They never inherit QR freshness. */
data class TicketSalesState(
    val snapshot: TicketSalesSnapshot? = null,
    val isLoading: Boolean = false,
    val isStale: Boolean = true,
    val error: String? = null,
    val checkedAtMillis: Long? = null,
) {
    fun snapshotForEvent(eventId: String?): TicketSalesSnapshot? =
        snapshot?.takeIf { eventId == null || it.eventId == eventId }

    fun receive(next: TicketSalesSnapshot, checkedAt: Long, expectedEventId: String? = null): TicketSalesState {
        if (expectedEventId != null && next.eventId != expectedEventId) {
            return failed("Las ventas recibidas corresponden a otro evento. Actualiza para reintentar.")
        }
        val previous = snapshot?.takeIf { it.eventId == next.eventId }
        if (previous != null && next.updatedAtMillis < previous.updatedAtMillis) return copy(isLoading = false)
        return TicketSalesState(next, isLoading = false, isStale = false, checkedAtMillis = checkedAt)
    }

    fun failed(message: String) = copy(isLoading = false, isStale = true, error = message)
}
