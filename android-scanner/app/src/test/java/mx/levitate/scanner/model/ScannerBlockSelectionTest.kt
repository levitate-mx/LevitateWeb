package mx.levitate.scanner.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class ScannerBlockSelectionTest {
    private val payload = "LEVITATE:TICKET:LV-AB12-CD34"
    private val catalog = listOf(
        ScannerBlock("bloque-2", "Bloque 2"),
        ScannerBlock("bloque-7", "Bloque 7"),
    )
    private val ready = ScannerUiState(
        sessionState = SessionState.SignedIn(ScannerDevice("device", "Puerta", catalog)),
    )

    @Test
    fun freshSessionRequiresExplicitSelection() {
        assertNull(ready.selectedBlock)
        assertNull(ready.newAttempt(payload))
    }

    @Test
    fun onlyServerCatalogChoicesCanEnableScanning() {
        val unknownSelection = ready.selectBlock("bloque-1")
        assertNull(unknownSelection.selectedBlock)
        assertNull(unknownSelection.newAttempt(payload))

        val selected = ready.selectBlock("bloque-7")
        assertEquals(catalog[1], selected.selectedBlock)
        assertEquals(TicketScanAttempt(payload, "bloque-7"), selected.newAttempt(payload))
    }

    @Test
    fun missingOrChangedCatalogDoesNotReuseStaleBlock() {
        val selected = ready.selectBlock("bloque-7")
        val changedCatalog = selected.copy(
            sessionState = SessionState.SignedIn(ScannerDevice("device", "Puerta", listOf(catalog[0]))),
        )
        assertNull(changedCatalog.selectedBlock)
        assertNull(changedCatalog.newAttempt(payload))
        assertNull(selected.copy(sessionState = SessionState.SignedOut).newAttempt(payload))
    }

    @Test
    fun operatorCanChangeBlockBetweenTickets() {
        val selected = ready.selectBlock("bloque-2").selectBlock("bloque-7")
        assertEquals("bloque-7", selected.newAttempt(payload)?.blockId)
    }

    @Test
    fun blockCannotChangeWhileCheckingOrWaitingForRetry() {
        val selected = ready.selectBlock("bloque-2")
        val attempt = requireNotNull(selected.newAttempt(payload))
        val checking = selected.copy(scanState = ScanState.Checking(attempt))
        val failed = selected.copy(scanState = ScanState.NetworkFailure(attempt, "Sin conexión"))

        assertSame(checking, checking.selectBlock("bloque-7"))
        assertSame(failed, failed.selectBlock("bloque-7"))
        assertNull(checking.newAttempt(payload))
        assertNull(failed.newAttempt(payload))
        assertEquals("bloque-2", (failed.scanState as ScanState.NetworkFailure).attempt.blockId)
    }

    @Test
    fun capturedAttemptKeepsBlockAndQrWhenNextSelectionChanges() {
        val selected = ready.selectBlock("bloque-2")
        val attempt = requireNotNull(selected.newAttempt(payload))
        val nextSelection = selected.selectBlock("bloque-7")

        assertEquals("bloque-7", nextSelection.selectedBlockId)
        assertEquals("bloque-2", attempt.blockId)
        assertEquals(payload, attempt.payload)
    }

    @Test
    fun resultMustBeDismissedBeforeChangingBlockOrScanningAgain() {
        val selected = ready.selectBlock("bloque-2")
        val complete = selected.copy(scanState = ScanState.Complete(ScanDecision(true, "accepted", "Canjear pulsera", null)))

        assertSame(complete, complete.selectBlock("bloque-7"))
        assertNull(complete.newAttempt(payload))
        assertEquals("bloque-7", complete.copy(scanState = ScanState.Ready).selectBlock("bloque-7").selectedBlockId)
    }
}
