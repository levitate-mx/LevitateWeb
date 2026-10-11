package mx.levitate.scanner

import android.app.Application
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import mx.levitate.scanner.data.ApiException
import mx.levitate.scanner.data.LevitateApi
import mx.levitate.scanner.data.SecureSessionStore
import mx.levitate.scanner.data.SessionExpiredException
import mx.levitate.scanner.model.ScanDecision
import mx.levitate.scanner.model.ScannerUiState
import mx.levitate.scanner.model.ScannerPairingPayload
import mx.levitate.scanner.model.ScanState
import mx.levitate.scanner.model.SessionState
import mx.levitate.scanner.model.TicketPayload
import mx.levitate.scanner.model.TicketScanAttempt
import mx.levitate.scanner.model.AttendanceState
import mx.levitate.scanner.model.TicketSalesState

class ScannerViewModel(application: Application) : AndroidViewModel(application) {
    private val api = LevitateApi(BuildConfig.API_BASE_URL, SecureSessionStore(application))
    private val mutableState = MutableStateFlow(ScannerUiState())
    val state: StateFlow<ScannerUiState> = mutableState.asStateFlow()
    private var foreground = false
    private var pollingJob: Job? = null
    private var attendanceJob: Job? = null
    private var historyJob: Job? = null
    private var salesJob: Job? = null
    private var historySalesJob: Job? = null
    private var attendanceRequest = 0L
    private var historyRequest = 0L
    private var salesRequest = 0L
    private var historySalesRequest = 0L

    init {
        restoreSession()
    }

    fun retryProvisioning() {
        provisionBundledDevice()
    }

    fun setForeground(active: Boolean) {
        if (foreground == active) return
        foreground = active
        pollingJob?.cancel()
        if (!active) {
            attendanceRequest += 1
            historyRequest += 1
            salesRequest += 1
            historySalesRequest += 1
            attendanceJob?.cancel()
            historyJob?.cancel()
            salesJob?.cancel()
            historySalesJob?.cancel()
            mutableState.update { it.copy(
                attendance = it.attendance.copy(isLoading = false, isStale = true),
                historyAttendance = it.historyAttendance.copy(isLoading = false, isStale = true),
                ticketSales = it.ticketSales.copy(isLoading = false, isStale = true),
                historyTicketSales = it.historyTicketSales.copy(isLoading = false, isStale = true),
            ) }
            return
        }
        refreshSummaries()
        if (state.value.historyVisible) refreshHistorySummaries()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                delay(30_000)
                refreshAttendance()
                if (state.value.historyVisible) refreshHistory()
            }
        }
    }

    fun refreshSummaries() {
        refreshAttendance()
        refreshSales()
    }

    private fun refreshSales() {
        if (!foreground || state.value.sessionState !is SessionState.SignedIn || salesJob?.isActive == true) return
        val requestId = ++salesRequest
        mutableState.update { it.copy(ticketSales = it.ticketSales.copy(isLoading = true)) }
        salesJob = viewModelScope.launch {
            try {
                val snapshot = api.ticketSales()
                if (requestId == salesRequest) mutableState.update {
                    it.copy(ticketSales = it.ticketSales.receive(snapshot, System.currentTimeMillis()))
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                if (requestId == salesRequest) {
                    if (error is SessionExpiredException) expireSession(error)
                    else mutableState.update { it.copy(ticketSales = it.ticketSales.failed(error.salesMessage())) }
                }
            }
        }
    }

    fun refreshAttendance() {
        if (!foreground || state.value.sessionState !is SessionState.SignedIn || attendanceJob?.isActive == true) return
        val requestId = ++attendanceRequest
        mutableState.update { it.copy(attendance = it.attendance.copy(isLoading = true)) }
        attendanceJob = viewModelScope.launch {
            try {
                val snapshot = api.attendance()
                if (requestId == attendanceRequest) mutableState.update {
                    it.copy(attendance = it.attendance.receive(snapshot, System.currentTimeMillis()))
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                if (requestId == attendanceRequest) {
                    if (error is SessionExpiredException) expireSession(error)
                    else mutableState.update {
                        it.copy(attendance = it.attendance.failed(error.attendanceMessage()))
                    }
                }
            }
        }
    }

    fun openHistory() {
        val current = state.value.attendance
        val sales = state.value.ticketSales
        val eventId = current.snapshot?.eventId ?: sales.snapshot?.eventId
        mutableState.update { it.copy(
            historyVisible = true,
            historyEventId = eventId,
            historyAttendance = if (current.snapshot?.eventId == eventId) current.copy(isLoading = false) else AttendanceState(),
            historyTicketSales = if (sales.snapshot?.eventId == eventId) sales.copy(isLoading = false) else TicketSalesState(),
        ) }
        refreshHistorySummaries()
    }

    fun closeHistory() {
        historyRequest += 1
        historySalesRequest += 1
        historyJob?.cancel()
        historySalesJob?.cancel()
        mutableState.update { it.copy(
            historyVisible = false,
            historyAttendance = it.historyAttendance.copy(isLoading = false),
            historyTicketSales = it.historyTicketSales.copy(isLoading = false),
        ) }
    }

    fun selectHistoryEvent(eventId: String) {
        val available = (state.value.attendance.snapshot?.events.orEmpty() + state.value.historyAttendance.snapshot?.events.orEmpty())
            .map { it.id } + listOfNotNull(state.value.ticketSales.snapshot?.eventId, state.value.historyTicketSales.snapshot?.eventId)
        if (!state.value.historyVisible || eventId == state.value.historyEventId || eventId !in available) return
        historyRequest += 1
        historySalesRequest += 1
        historyJob?.cancel()
        historySalesJob?.cancel()
        historyJob = null
        historySalesJob = null
        mutableState.update { it.copy(historyEventId = eventId, historyAttendance = AttendanceState(), historyTicketSales = TicketSalesState()) }
        refreshHistorySummaries()
    }

    fun refreshHistorySummaries() {
        refreshHistory()
        refreshHistorySales()
    }

    private fun refreshHistorySales() {
        if (!foreground || !state.value.historyVisible || state.value.sessionState !is SessionState.SignedIn || historySalesJob?.isActive == true) return
        val eventId = state.value.historyEventId
        val requestId = ++historySalesRequest
        mutableState.update { it.copy(historyTicketSales = it.historyTicketSales.copy(isLoading = true)) }
        historySalesJob = viewModelScope.launch {
            try {
                val snapshot = api.ticketSales(eventId)
                if (requestId == historySalesRequest) mutableState.update {
                    val expectedEventId = it.historyEventId ?: eventId
                    it.copy(
                        historyEventId = expectedEventId ?: snapshot.eventId,
                        historyTicketSales = it.historyTicketSales.receive(snapshot, System.currentTimeMillis(), expectedEventId),
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                if (requestId == historySalesRequest) {
                    if (error is SessionExpiredException) expireSession(error)
                    else mutableState.update { it.copy(historyTicketSales = it.historyTicketSales.failed(error.salesMessage())) }
                }
            }
        }
    }

    fun refreshHistory() {
        if (!foreground || !state.value.historyVisible || state.value.sessionState !is SessionState.SignedIn || historyJob?.isActive == true) return
        val eventId = state.value.historyEventId
        val requestId = ++historyRequest
        mutableState.update { it.copy(historyAttendance = it.historyAttendance.copy(isLoading = true)) }
        historyJob = viewModelScope.launch {
            try {
                val snapshot = api.attendance(eventId)
                if (requestId == historyRequest) mutableState.update {
                    val expectedEventId = it.historyEventId ?: eventId
                    it.copy(
                        historyEventId = expectedEventId ?: snapshot.eventId,
                        historyAttendance = it.historyAttendance.receive(snapshot, System.currentTimeMillis(), expectedEventId),
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                if (requestId == historyRequest) {
                    if (error is SessionExpiredException) expireSession(error)
                    else mutableState.update {
                        it.copy(historyAttendance = it.historyAttendance.failed(error.attendanceMessage()))
                    }
                }
            }
        }
    }

    private fun provisionBundledDevice() {
        if (state.value.activationInProgress) return

        val pairingPayload = ScannerPairingPayload.normalize(BuildConfig.SCANNER_BOOTSTRAP_PAYLOAD)
        if (pairingPayload == null) {
            mutableState.update {
                it.copy(
                    sessionState = SessionState.SignedOut,
                    activationError = "Esta instalación no está configurada. Solicita un nuevo APK de Levitate Entrada.",
                )
            }
            return
        }

        val deviceName = listOf(Build.MANUFACTURER, Build.MODEL)
            .filter(String::isNotBlank)
            .joinToString(" ")
            .ifBlank { "Escáner Android" }

        mutableState.update {
            it.copy(
                sessionState = SessionState.Loading,
                activationInProgress = true,
                activationError = null,
            )
        }
        viewModelScope.launch {
            runCatching { api.activate(pairingPayload, deviceName) }
                .onSuccess { device ->
                    mutableState.update {
                        it.copy(
                            sessionState = SessionState.SignedIn(device),
                            scanState = ScanState.Ready,
                            activationInProgress = false,
                            activationError = null,
                            selectedBlockId = null,
                        )
                    }
                    refreshSummaries()
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            sessionState = SessionState.SignedOut,
                            activationInProgress = false,
                            activationError = error.displayMessage(),
                        )
                    }
                }
        }
    }

    fun selectBlock(blockId: String) {
        mutableState.update { it.selectBlock(blockId) }
        refreshAttendance()
    }

    fun scan(rawValue: String) {
        val currentState = state.value
        if (currentState.scanState !is ScanState.Ready || currentState.selectedBlock == null) return

        val payload = TicketPayload.normalize(rawValue)
        if (payload == null) {
            completeLocally(
                ScanDecision(
                    admitted = false,
                    reason = "invalid_format",
                    message = "El QR no corresponde a un boleto de Levitate.",
                    ticket = null,
                ),
            )
            return
        }

        val attempt = currentState.newAttempt(payload) ?: return
        submitScan(attempt)
    }

    private fun submitScan(attempt: TicketScanAttempt) {
        mutableState.update { it.copy(scanState = ScanState.Checking(attempt)) }
        viewModelScope.launch {
            runCatching { api.scanTicket(attempt.payload, attempt.blockId) }
                .onSuccess(::completeLocally)
                .onFailure { error ->
                    when (error) {
                        is SessionExpiredException -> expireSession(error)

                        else -> mutableState.update {
                            it.copy(
                                scanState = ScanState.NetworkFailure(attempt, error.displayMessage()),
                                attendance = it.attendance.copy(isStale = true),
                            )
                        }
                    }
                }
        }
    }

    fun retryLastScan() {
        val failure = state.value.scanState as? ScanState.NetworkFailure ?: return
        submitScan(failure.attempt)
    }

    fun continueScanning() {
        mutableState.update { it.copy(scanState = ScanState.Ready) }
    }

    private fun restoreSession() {
        viewModelScope.launch {
            runCatching { api.restoreDevice() }
                .onSuccess { device ->
                    if (device == null) {
                        provisionBundledDevice()
                    } else {
                        mutableState.update {
                            it.copy(
                                sessionState = SessionState.SignedIn(device),
                                activationError = null,
                            )
                        }
                        refreshSummaries()
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(sessionState = SessionState.SignedOut, activationError = error.displayMessage())
                    }
                }
        }
    }

    private fun completeLocally(decision: ScanDecision) {
        val currentEventId = state.value.attendance.snapshot?.eventId
        val updatesCurrent = decision.attendance != null &&
            (currentEventId == null || currentEventId == decision.attendance.eventId)
        if (updatesCurrent) {
            // Ignore any older GET that was started before this scan completed.
            attendanceRequest += 1
            attendanceJob?.cancel()
            attendanceJob = null
        }
        mutableState.update {
            val next = it.copy(scanState = ScanState.Complete(decision))
            decision.attendance?.let { snapshot ->
                next.receiveScanAttendance(snapshot, System.currentTimeMillis())
            } ?: next.copy(attendance = next.attendance.copy(isStale = true))
        }
        if (!updatesCurrent) refreshAttendance()
    }

    private fun expireSession(error: SessionExpiredException) {
        attendanceRequest += 1
        historyRequest += 1
        salesRequest += 1
        historySalesRequest += 1
        attendanceJob?.cancel()
        historyJob?.cancel()
        salesJob?.cancel()
        historySalesJob?.cancel()
        mutableState.update {
            it.copy(
                sessionState = SessionState.SignedOut,
                scanState = ScanState.Ready,
                activationError = error.message,
                selectedBlockId = null,
                attendance = AttendanceState(),
                ticketSales = TicketSalesState(),
                historyAttendance = AttendanceState(),
                historyTicketSales = TicketSalesState(),
                historyEventId = null,
                historyVisible = false,
            )
        }
    }
}

private fun Throwable.salesMessage(): String = when (this) {
    is IOException -> "Sin conexión: las ventas no están actualizadas."
    is ApiException -> message
    else -> "No se pudieron actualizar las ventas. Intenta nuevamente."
}

private fun Throwable.attendanceMessage(): String = when (this) {
    is IOException -> "Sin conexión: el contador no está actualizado."
    is ApiException -> message
    else -> "No se pudo actualizar el contador. Intenta nuevamente."
}

private fun Throwable.displayMessage(): String = when (this) {
    is ApiException -> message
    is IOException -> "No hay conexión con Levitate. No permitas el acceso y vuelve a intentar."
    else -> message?.takeIf(String::isNotBlank) ?: "Ocurrió un error inesperado."
}
