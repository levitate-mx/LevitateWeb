package mx.levitate.scanner.model

data class ScannerDevice(
    val id: String,
    val name: String,
    val blocks: List<ScannerBlock>,
)

data class ScannerBlock(
    val id: String,
    val label: String,
    val dayId: String? = null,
    val date: String? = null,
)

data class TicketScanAttempt(
    val payload: String,
    val blockId: String,
)

data class TicketInfo(
    val code: String,
    val label: String,
    val holderName: String,
    val status: String,
    val usedAt: String?,
)

data class ScanDecision(
    val admitted: Boolean,
    val reason: String,
    val message: String,
    val ticket: TicketInfo?,
    val attendance: AttendanceSnapshot? = null,
)

sealed interface SessionState {
    data object Loading : SessionState
    data object SignedOut : SessionState
    data class SignedIn(val device: ScannerDevice) : SessionState
}

sealed interface ScanState {
    data object Ready : ScanState
    data class Checking(val attempt: TicketScanAttempt) : ScanState
    data class Complete(val decision: ScanDecision) : ScanState
    data class NetworkFailure(val attempt: TicketScanAttempt, val message: String) : ScanState
}

data class ScannerUiState(
    val sessionState: SessionState = SessionState.Loading,
    val scanState: ScanState = ScanState.Ready,
    val activationInProgress: Boolean = false,
    val activationError: String? = null,
    val selectedBlockId: String? = null,
    val attendance: AttendanceState = AttendanceState(),
    val ticketSales: TicketSalesState = TicketSalesState(),
    val historyAttendance: AttendanceState = AttendanceState(),
    val historyTicketSales: TicketSalesState = TicketSalesState(),
    val historyEventId: String? = null,
    val historyVisible: Boolean = false,
) {
    val availableBlocks: List<ScannerBlock>
        get() = (sessionState as? SessionState.SignedIn)?.device?.blocks.orEmpty()

    val selectedBlock: ScannerBlock?
        get() = availableBlocks.firstOrNull { it.id == selectedBlockId }

    fun selectBlock(blockId: String): ScannerUiState {
        if (scanState !is ScanState.Ready || availableBlocks.none { it.id == blockId }) return this
        return copy(selectedBlockId = blockId)
    }

    fun newAttempt(payload: String): TicketScanAttempt? {
        if (scanState !is ScanState.Ready) return null
        val block = selectedBlock ?: return null
        return TicketScanAttempt(payload, block.id)
    }

    fun receiveScanAttendance(snapshot: AttendanceSnapshot, checkedAt: Long): ScannerUiState {
        val currentEventId = attendance.snapshot?.eventId
        return copy(
            attendance = if (currentEventId == null || currentEventId == snapshot.eventId) {
                attendance.receive(snapshot, checkedAt, currentEventId)
            } else attendance,
            historyAttendance = if (historyVisible && historyEventId == snapshot.eventId) {
                historyAttendance.receive(snapshot, checkedAt, historyEventId)
            } else historyAttendance,
        )
    }
}

object TicketPayload {
    private const val prefix = "LEVITATE:TICKET:"
    private val ticketPattern = Regex("^LV-[A-Z0-9-]{8,36}$")

    fun normalize(value: String): String? {
        val normalized = value.trim().uppercase()
        val ticketCode = if (normalized.startsWith(prefix)) {
            normalized.removePrefix(prefix)
        } else {
            normalized
        }

        return if (ticketPattern.matches(ticketCode)) "$prefix$ticketCode" else null
    }
}

object ScannerPairingPayload {
    private const val prefix = "LEVITATE:SCANNER-PAIR:"
    private val tokenPattern = Regex("^[A-Za-z0-9_-]{32,128}$")

    fun normalize(value: String): String? {
        val normalized = value.trim()

        if (!normalized.startsWith(prefix, ignoreCase = true)) return null

        val token = normalized.substring(prefix.length).trim()
        return if (tokenPattern.matches(token)) "$prefix$token" else null
    }
}
