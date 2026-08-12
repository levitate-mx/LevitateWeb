package mx.levitate.scanner

import android.app.Application
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.IOException
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

class ScannerViewModel(application: Application) : AndroidViewModel(application) {
    private val api = LevitateApi(BuildConfig.API_BASE_URL, SecureSessionStore(application))
    private val mutableState = MutableStateFlow(ScannerUiState())
    val state: StateFlow<ScannerUiState> = mutableState.asStateFlow()

    init {
        restoreSession()
    }

    fun retryProvisioning() {
        provisionBundledDevice()
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
                        )
                    }
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

    fun scan(rawValue: String) {
        if (state.value.scanState !is ScanState.Ready) return

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

        mutableState.update { it.copy(scanState = ScanState.Checking(payload)) }
        viewModelScope.launch {
            runCatching { api.scanTicket(payload) }
                .onSuccess(::completeLocally)
                .onFailure { error ->
                    when (error) {
                        is SessionExpiredException -> mutableState.update {
                            it.copy(
                                sessionState = SessionState.SignedOut,
                                scanState = ScanState.Ready,
                                activationError = error.message,
                            )
                        }

                        else -> mutableState.update {
                            it.copy(scanState = ScanState.NetworkFailure(payload, error.displayMessage()))
                        }
                    }
                }
        }
    }

    fun retryLastScan() {
        val failure = state.value.scanState as? ScanState.NetworkFailure ?: return
        mutableState.update { it.copy(scanState = ScanState.Ready) }
        scan(failure.payload)
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
        mutableState.update {
            it.copy(
                scanState = ScanState.Complete(decision),
                acceptedCount = it.acceptedCount + if (decision.admitted) 1 else 0,
                rejectedCount = it.rejectedCount + if (decision.admitted) 0 else 1,
            )
        }
    }
}

private fun Throwable.displayMessage(): String = when (this) {
    is ApiException -> message
    is IOException -> "No hay conexión con Levitate. No permitas el acceso y vuelve a intentar."
    else -> message?.takeIf(String::isNotBlank) ?: "Ocurrió un error inesperado."
}
