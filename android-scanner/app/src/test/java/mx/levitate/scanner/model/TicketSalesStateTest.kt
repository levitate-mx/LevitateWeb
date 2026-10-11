package mx.levitate.scanner.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class TicketSalesStateTest {
    private fun snapshot(
        eventId: String = "current",
        sold: Long = 120,
        time: String = "2026-11-14T16:00:00.000Z",
    ) = TicketSalesSnapshot(eventId, "Evento $eventId", "edomex", time, 500, sold, 0,
        listOf(BlockTicketSales("bloque-1", "Bloque 1", "sabado-14", "2026-11-14", sold, sold, 0, 0)))

    @Test
    fun capacityShowsPurchasedTicketsAndNeverClampsThePercentage() {
        val normal = TicketSalesCapacity(120, 500)
        assertEquals(24.0, normal.percentage, 0.001)
        assertEquals("24%", normal.percentageLabel)
        assertEquals(0.24f, normal.progress, 0.001f)
        val over = TicketSalesCapacity(501, 500)
        assertEquals("100.2%", over.percentageLabel)
        assertEquals(1f, over.progress, 0f)
        assertTrue(over.exceedsCapacity)
        assertFalse(TicketSalesCapacity(500, 500).exceedsCapacity)
    }

    @Test
    fun confirmedZeroSalesIsDifferentFromMissingData() {
        val unavailable = TicketSalesState().failed("Sin conexión")
        assertNull(unavailable.snapshot)
        val loaded = unavailable.receive(snapshot(sold = 0), 100)
        assertEquals(0L, loaded.snapshot?.blocks?.single()?.total)
        assertEquals("0%", TicketSalesCapacity(0, 500).percentageLabel)
        assertEquals(0f, TicketSalesCapacity(0, 500).progress, 0f)
        assertFalse(loaded.isStale)
    }

    @Test
    fun cancellationsCanReduceSalesWithoutRejectingNewData() {
        val before = TicketSalesState().receive(snapshot(), 100)
        val after = before.receive(snapshot(sold = 110, time = "2026-11-14T16:01:00.000Z"), 200)
        assertEquals(110L, after.snapshot?.uniqueTickets)
        assertEquals(110L, after.snapshot?.blocks?.single()?.total)
        assertEquals(200L, after.checkedAtMillis)
        assertFalse(after.isStale)
    }

    @Test
    fun lateResponseCannotRestoreSalesFromBeforeCancellation() {
        val newer = TicketSalesState().receive(snapshot(sold = 110, time = "2026-11-14T16:01:00.000Z"), 200)
        assertEquals(newer, newer.receive(snapshot(sold = 120), 300))
    }

    @Test
    fun errorsKeepLastSalesAndNeverRefreshTheirTimestamp() {
        val loaded = TicketSalesState().receive(snapshot(), 100)
        val failed = loaded.copy(isLoading = true).failed("Sin conexión")
        assertEquals(loaded.snapshot, failed.snapshot)
        assertEquals(100L, failed.checkedAtMillis)
        assertTrue(failed.isStale)
        assertFalse(failed.isLoading)
    }

    @Test
    fun sameBlockIdInDifferentEventsCannotMixSales() {
        val loaded = TicketSalesState().receive(snapshot(), 100)
        assertNotNull(loaded.snapshotForEvent("current"))
        assertNull(loaded.snapshotForEvent("previous"))
        val wrong = loaded.receive(snapshot(eventId = "previous"), 200, "current")
        assertEquals(loaded.snapshot, wrong.snapshot)
        assertTrue(wrong.isStale)
    }

    @Test
    fun qrRefreshDoesNotChangeSalesCountsFreshnessOrHistoricalEvent() {
        val sales = TicketSalesState().receive(snapshot(), 100)
        val history = TicketSalesState().receive(snapshot(eventId = "previous", sold = 300), 90)
        val initial = ScannerUiState(ticketSales = sales, historyTicketSales = history,
            historyEventId = "previous", historyVisible = true)
        val qr = AttendanceSnapshot("current", "Evento current", "edomex", "2026-11-14T16:02:00.000Z", 2,
            listOf(BlockAttendance("bloque-1", "Bloque 1", "sabado-14", "2026-11-14", 2, 2, 0, 0)),
            listOf(AttendanceEvent("current", "Evento current")))
        val after = initial.receiveScanAttendance(qr, 300)
        assertEquals(sales, after.ticketSales)
        assertEquals(history, after.historyTicketSales)
        assertEquals("previous", after.historyEventId)
        assertEquals(2L, after.attendance.snapshot?.uniqueAdmissions)
    }

    @Test
    fun salesFailureDoesNotChangeValidQrDecision() {
        val accepted = ScanDecision(true, "accepted", "Acceso permitido", null)
        val state = ScannerUiState(scanState = ScanState.Complete(accepted))
        val failed = state.copy(ticketSales = state.ticketSales.failed("Sin ventas disponibles"))
        assertEquals(accepted, (failed.scanState as ScanState.Complete).decision)
    }

    @Test
    fun invalidCapacitiesAndInconsistentCountersAreRejected() {
        assertThrows(IllegalArgumentException::class.java) { TicketSalesCapacity(1, 0) }
        assertThrows(IllegalArgumentException::class.java) { snapshot().copy(capacityPerBlock = 0) }
        assertThrows(IllegalArgumentException::class.java) { snapshot().copy(uniqueTickets = -1) }
        assertThrows(IllegalArgumentException::class.java) { snapshot().copy(unassignedTickets = -1) }
        assertThrows(IllegalArgumentException::class.java) {
            BlockTicketSales("bloque-1", "Bloque 1", "sabado-14", "2026-11-14", 4, 2, 2, 1)
        }
        assertThrows(IllegalArgumentException::class.java) { snapshot(time = "ayer") }
    }
}
