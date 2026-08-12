package mx.levitate.scanner.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TicketPayloadTest {
    @Test
    fun acceptsGeneratedQrPayload() {
        assertEquals(
            "LEVITATE:TICKET:LV-AB12-CD34",
            TicketPayload.normalize("levitate:ticket:lv-ab12-cd34"),
        )
    }

    @Test
    fun acceptsManualTicketCode() {
        assertEquals(
            "LEVITATE:TICKET:LV-AB12-CD34",
            TicketPayload.normalize(" LV-AB12-CD34 "),
        )
    }

    @Test
    fun rejectsUnrelatedQr() {
        assertNull(TicketPayload.normalize("https://example.com/ticket/123"))
    }

    @Test
    fun acceptsScannerPairingQrWithoutChangingTokenCase() {
        val token = "AbCdEfGhIjKlMnOpQrStUvWxYz_1234567890abcd"

        assertEquals(
            "LEVITATE:SCANNER-PAIR:$token",
            ScannerPairingPayload.normalize("levitate:scanner-pair:$token"),
        )
    }

    @Test
    fun rejectsUnrelatedScannerPairingQr() {
        assertNull(ScannerPairingPayload.normalize("LEVITATE:TICKET:LV-AB12-CD34"))
    }
}
