package mx.levitate.scanner.model

data class ScannerDevice(
    val id: String,
    val name: String,
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
)

sealed interface SessionState {
    data object Loading : SessionState
    data object SignedOut : SessionState
    data class SignedIn(val device: ScannerDevice) : SessionState
}

sealed interface ScanState {
    data object Ready : ScanState
    data class Checking(val payload: String) : ScanState
    data class Complete(val decision: ScanDecision) : ScanState
    data class NetworkFailure(val payload: String, val message: String) : ScanState
}

data class ScannerUiState(
    val sessionState: SessionState = SessionState.Loading,
    val scanState: ScanState = ScanState.Ready,
    val activationInProgress: Boolean = false,
    val activationError: String? = null,
    val acceptedCount: Int = 0,
    val rejectedCount: Int = 0,
)

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
