package mx.levitate.scanner.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class AttendanceStateTest {
    private val events = listOf(AttendanceEvent("current", "Actual"), AttendanceEvent("previous", "Anterior"))

    private fun snapshot(
        eventId: String = "current",
        count: Long = 8,
        time: String = "2026-11-14T16:00:00.000Z",
    ) = AttendanceSnapshot(eventId, "Evento $eventId", "edomex", time, count,
        listOf(BlockAttendance("bloque-1", "Bloque 1", "sabado-14", "2026-11-14", count, count, 0, 0)), events)

    @Test
    fun unavailableDataDoesNotImplyZeroAdmissions() {
        val empty = AttendanceState().failed("Sin conexión")
        assertNull(empty.snapshot)
        assertTrue(empty.isStale)
        val available = empty.receive(snapshot(count = 0), 100)
        assertEquals(0L, available.snapshot?.uniqueAdmissions)
        assertFalse(available.isStale)
        assertNull(available.error)
    }

    @Test
    fun failurePreservesLastConfirmedTotalsAndFreshnessTime() {
        val loaded = AttendanceState().receive(snapshot(), 100)
        val failed = loaded.copy(isLoading = true).failed("Sin conexión")
        assertEquals(8L, failed.snapshot?.blocks?.single()?.total)
        assertEquals(100L, failed.checkedAtMillis)
        assertTrue(failed.isStale)
        assertFalse(failed.isLoading)
    }

    @Test
    fun olderRefreshCannotReplaceNewerScanAndHigherCountCannotGoBackwards() {
        val latest = AttendanceState().receive(snapshot(count = 9, time = "2026-11-14T16:01:00.000Z"), 100)
        val olderTime = latest.receive(snapshot(count = 8), 200)
        val laterResponseWithOlderData = latest.receive(snapshot(count = 8, time = "2026-11-14T16:02:00.000Z"), 300)
        assertEquals(latest, olderTime)
        assertEquals(latest, laterResponseWithOlderData)
        assertEquals(100L, laterResponseWithOlderData.checkedAtMillis)
    }

    @Test
    fun duplicateScanUsesServerTotalInsteadOfAddingAnotherAdmission() {
        val initial = ScannerUiState(attendance = AttendanceState().receive(snapshot(), 100))
        val again = initial.receiveScanAttendance(snapshot(), 200).receiveScanAttendance(snapshot(), 300)
        assertEquals(8L, again.attendance.snapshot?.uniqueAdmissions)
        assertEquals(8L, again.attendance.snapshot?.blocks?.single()?.total)
    }

    @Test
    fun browsingOldEventCannotReplaceCurrentScannerCounter() {
        val current = AttendanceState().receive(snapshot(), 100)
        val historical = AttendanceState().receive(snapshot(eventId = "previous", count = 40), 100)
        val state = ScannerUiState(attendance = current, historyAttendance = historical,
            historyEventId = "previous", historyVisible = true)
        val scan = state.receiveScanAttendance(snapshot(count = 9), 200)
        assertEquals(9L, scan.attendance.snapshot?.uniqueAdmissions)
        assertEquals(40L, scan.historyAttendance.snapshot?.uniqueAdmissions)
        assertEquals("previous", scan.historyEventId)
        val historicalScan = state.receiveScanAttendance(snapshot(eventId = "previous", count = 41), 200)
        assertEquals(current, historicalScan.attendance)
        assertEquals(41L, historicalScan.historyAttendance.snapshot?.uniqueAdmissions)
    }

    @Test
    fun lateHistoryResponseForDifferentSelectionIsNotDisplayed() {
        val current = AttendanceState().receive(snapshot(), 100)
        val wrongEvent = current.receive(snapshot(eventId = "previous"), 200, "current")
        assertEquals("current", wrongEvent.snapshot?.eventId)
        assertTrue(wrongEvent.isStale)
        assertNotNull(wrongEvent.error)
    }

    @Test
    fun malformedOrInconsistentSnapshotsAreRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            BlockAttendance("bloque-1", "Bloque 1", "sabado-14", "2026-11-14", 4, 2, 2, 1)
        }
        assertThrows(IllegalArgumentException::class.java) { snapshot(count = -1) }
        assertThrows(IllegalArgumentException::class.java) { snapshot(time = "ayer") }
        val valid = snapshot()
        assertThrows(IllegalArgumentException::class.java) { valid.copy(blocks = valid.blocks + valid.blocks) }
        assertThrows(IllegalArgumentException::class.java) { valid.copy(uniqueAdmissions = 1) }
        assertNull(parseAttendanceTimestamp("2026-11-14T16:00:00.000Z extra"))
        assertEquals(parseAttendanceTimestamp("2026-11-14T16:00:00.000Z"), parseAttendanceTimestamp("2026-11-14T16:00:00Z"))
    }

    @Test
    fun summaryFailureDoesNotReplaceAcceptedQrDecision() {
        val accepted = ScanDecision(true, "accepted", "Acceso permitido", null)
        val state = ScannerUiState(scanState = ScanState.Complete(accepted), attendance = AttendanceState().receive(snapshot(), 100))
        val afterError = state.copy(attendance = state.attendance.failed("No se pudo actualizar"))
        assertEquals(accepted, (afterError.scanState as ScanState.Complete).decision)
        assertTrue((afterError.scanState as ScanState.Complete).decision.admitted)
    }
}
