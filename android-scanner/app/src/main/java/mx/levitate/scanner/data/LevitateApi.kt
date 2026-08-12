package mx.levitate.scanner.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import mx.levitate.scanner.model.ScanDecision
import mx.levitate.scanner.model.ScannerDevice
import mx.levitate.scanner.model.TicketInfo
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class LevitateApi(
    baseUrl: String,
    private val sessionStore: SecureSessionStore,
) {
    private val baseUrl = baseUrl.trimEnd('/')

    suspend fun restoreDevice(): ScannerDevice? = withContext(Dispatchers.IO) {
        val token = sessionStore.readToken() ?: return@withContext null
        val response = request(
            path = "/api/registration/scanner/me",
            method = "GET",
            scannerToken = token,
        )

        if (response.status == HttpURLConnection.HTTP_UNAUTHORIZED || response.status == HttpURLConnection.HTTP_FORBIDDEN) {
            sessionStore.clear()
            return@withContext null
        }

        response.requireSuccess()
        parseDevice(response.body)
    }

    suspend fun activate(pairingPayload: String, deviceName: String): ScannerDevice = withContext(Dispatchers.IO) {
        val response = request(
            path = "/api/registration/scanner/activate",
            method = "POST",
            body = JSONObject()
                .put("pairingPayload", pairingPayload)
                .put("deviceName", deviceName),
        )
        response.requireSuccess()

        val deviceToken = response.body.optString("deviceToken")
            .takeIf(String::isNotBlank)
            ?: throw ApiException(response.status, "missing_device_token", "No se pudo proteger este dispositivo.")
        sessionStore.saveToken(deviceToken)
        parseDevice(response.body)
    }

    suspend fun scanTicket(payload: String): ScanDecision = withContext(Dispatchers.IO) {
        val token = sessionStore.readToken() ?: throw SessionExpiredException()
        val response = request(
            path = "/api/registration/scanner/ticket/scan",
            method = "POST",
            body = JSONObject().put("qrPayload", payload),
            scannerToken = token,
        )

        if (response.status == HttpURLConnection.HTTP_UNAUTHORIZED || response.status == HttpURLConnection.HTTP_FORBIDDEN) {
            sessionStore.clear()
            throw SessionExpiredException()
        }

        response.requireSuccess()
        val ticketJson = response.body.optJSONObject("ticket")

        ScanDecision(
            admitted = response.body.optBoolean("admitted", false),
            reason = response.body.optString("reason", "unknown"),
            message = response.body.optString("message", "No se pudo validar el boleto."),
            ticket = ticketJson?.let(::parseTicket),
        )
    }

    fun unlink() {
        sessionStore.clear()
    }

    private fun parseDevice(body: JSONObject): ScannerDevice {
        val device = body.optJSONObject("device")
            ?: throw ApiException(500, "invalid_scanner_session", "La respuesta de vinculación no es válida.")

        return ScannerDevice(
            id = device.optString("id"),
            name = device.optString("name", "Escáner de entrada"),
        )
    }

    private fun parseTicket(ticket: JSONObject) = TicketInfo(
        code = ticket.optString("ticketCode"),
        label = ticket.optString("ticketLabel", "Boleto Levitate"),
        holderName = ticket.optString("holderName", "Titular no especificado"),
        status = ticket.optString("status"),
        usedAt = ticket.optString("usedAt").takeIf { it.isNotBlank() && it != "null" },
    )

    private fun request(
        path: String,
        method: String,
        body: JSONObject? = null,
        scannerToken: String? = null,
    ): ApiResponse {
        val connection = (URL("$baseUrl$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 15_000
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-cache")
            setRequestProperty("User-Agent", "Levitate-Entrada-Android/1.0")
            scannerToken?.let { setRequestProperty("Authorization", "Scanner $it") }

            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                outputStream.bufferedWriter(Charsets.UTF_8).use { writer ->
                    writer.write(body.toString())
                }
            }
        }

        return try {
            val status = connection.responseCode
            val responseText = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(Charsets.UTF_8)
                ?.use { it.readText() }
                .orEmpty()
            val responseBody = runCatching { JSONObject(responseText) }.getOrElse { JSONObject() }

            ApiResponse(status, responseBody)
        } finally {
            connection.disconnect()
        }
    }
}

private data class ApiResponse(
    val status: Int,
    val body: JSONObject,
) {
    fun requireSuccess() {
        if (status in 200..299) return

        val error = body.optJSONObject("error")
        throw ApiException(
            status = status,
            code = error?.optString("code") ?: "request_failed",
            message = error?.optString("message")?.takeIf(String::isNotBlank)
                ?: "No se pudo completar la operación.",
        )
    }
}

class ApiException(
    val status: Int,
    val code: String,
    override val message: String,
) : Exception(message)

class SessionExpiredException : Exception("Este dispositivo ya no está vinculado.")
