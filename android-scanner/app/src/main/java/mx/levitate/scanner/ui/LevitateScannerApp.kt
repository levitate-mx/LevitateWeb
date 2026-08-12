package mx.levitate.scanner.ui

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.outlined.ConfirmationNumber
import androidx.compose.material.icons.outlined.Keyboard
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay
import mx.levitate.scanner.ScannerViewModel
import mx.levitate.scanner.model.ScannerDevice
import mx.levitate.scanner.model.ScanDecision
import mx.levitate.scanner.model.ScannerUiState
import mx.levitate.scanner.model.ScanState
import mx.levitate.scanner.model.SessionState

@Composable
fun LevitateScannerApp(viewModel: ScannerViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    when (val sessionState = state.sessionState) {
        SessionState.Loading -> LoadingScreen()
        SessionState.SignedOut -> SetupErrorScreen(
            error = state.activationError,
            onRetry = viewModel::retryProvisioning,
        )

        is SessionState.SignedIn -> ScannerScreen(
            device = sessionState.device,
            state = state,
            onScan = viewModel::scan,
            onRetry = viewModel::retryLastScan,
            onContinue = viewModel::continueScanning,
        )
    }
}

@Composable
private fun LoadingScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(LevitateBlack),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BrandLockup()
            Spacer(Modifier.height(28.dp))
            CircularProgressIndicator(color = LevitatePink, strokeWidth = 3.dp)
        }
    }
}

@Composable
private fun SetupErrorScreen(
    error: String?,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(LevitateBlack)
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        BrandLockup()
        Spacer(Modifier.height(48.dp))
        Icon(
            imageVector = Icons.Outlined.WifiOff,
            contentDescription = null,
            tint = LevitatePink,
            modifier = Modifier.size(72.dp),
        )
        Spacer(Modifier.height(24.dp))
        Text(
            text = "NO SE PUDO PREPARAR EL ESCÁNER",
            color = Color.White,
            fontSize = 25.sp,
            lineHeight = 31.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(14.dp))
        Text(
            text = error ?: "Revisa la conexión e intenta nuevamente.",
            color = Color(0xFFBDBDBD),
            fontSize = 16.sp,
            lineHeight = 23.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(30.dp))
        Button(
            onClick = onRetry,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(6.dp),
        ) {
            Icon(Icons.Outlined.Refresh, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("VOLVER A INTENTAR", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ScannerScreen(
    device: ScannerDevice,
    state: ScannerUiState,
    onScan: (String) -> Unit,
    onRetry: () -> Unit,
    onContinue: () -> Unit,
) {
    var torchEnabled by remember { mutableStateOf(false) }
    var showManualEntry by remember { mutableStateOf(false) }
    val scanEnabled = state.scanState is ScanState.Ready

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(LevitateBlack),
    ) {
        CameraSurface(
            torchEnabled = torchEnabled,
            onQrDetected = { if (scanEnabled) onScan(it) },
            modifier = Modifier.fillMaxSize(),
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.16f)),
        )
        ScanFrame(modifier = Modifier.fillMaxSize())

        ScannerHeader(
            device = device,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth(),
        )

        ScannerControls(
            acceptedCount = state.acceptedCount,
            rejectedCount = state.rejectedCount,
            torchEnabled = torchEnabled,
            onToggleTorch = { torchEnabled = !torchEnabled },
            onManualEntry = { showManualEntry = true },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth(),
        )

        when (val scanState = state.scanState) {
            is ScanState.Checking -> CheckingOverlay()
            is ScanState.Complete -> DecisionScreen(
                decision = scanState.decision,
                onContinue = onContinue,
            )

            is ScanState.NetworkFailure -> NetworkFailureScreen(
                message = scanState.message,
                onRetry = onRetry,
                onCancel = onContinue,
            )

            ScanState.Ready -> Unit
        }
    }

    if (showManualEntry) {
        ManualTicketDialog(
            onDismiss = { showManualEntry = false },
            onSubmit = {
                showManualEntry = false
                onScan(it)
            },
        )
    }
}

@Composable
private fun ScannerHeader(
    device: ScannerDevice,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .background(Color.Black.copy(alpha = 0.82f))
            .statusBarsPadding()
            .padding(start = 20.dp, end = 10.dp, top = 12.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Levitate",
            color = Color.White,
            fontFamily = FontFamily.Serif,
            fontSize = 27.sp,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = device.name,
            color = Color(0xFFBDBDBD),
            fontSize = 12.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.width(145.dp),
            textAlign = TextAlign.End,
        )
    }
}

@Composable
private fun ScanFrame(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val frameWidth = size.width * 0.72f
        val frameHeight = frameWidth
        val left = (size.width - frameWidth) / 2f
        val top = (size.height - frameHeight) / 2f - size.height * 0.04f
        val right = left + frameWidth
        val bottom = top + frameHeight
        val corner = frameWidth * 0.18f
        val strokeWidth = 8.dp.toPx()

        listOf(
            Pair(left to top, left + corner to top),
            Pair(left to top, left to top + corner),
            Pair(right to top, right - corner to top),
            Pair(right to top, right to top + corner),
            Pair(left to bottom, left + corner to bottom),
            Pair(left to bottom, left to bottom - corner),
            Pair(right to bottom, right - corner to bottom),
            Pair(right to bottom, right to bottom - corner),
        ).forEach { (start, end) ->
            drawLine(
                color = Color.White,
                start = androidx.compose.ui.geometry.Offset(start.first, start.second),
                end = androidx.compose.ui.geometry.Offset(end.first, end.second),
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round,
            )
        }
    }
}

@Composable
private fun ScannerControls(
    acceptedCount: Int,
    rejectedCount: Int,
    torchEnabled: Boolean,
    onToggleTorch: () -> Unit,
    onManualEntry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(Color.Black.copy(alpha = 0.86f))
            .navigationBarsPadding()
            .padding(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "APUNTA AL QR DEL BOLETO",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            letterSpacing = 1.4.sp,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            SessionCounter("ADMITIDOS", acceptedCount, AccessGreen, Modifier.weight(1f))
            SessionCounter("RECHAZADOS", rejectedCount, RejectRed, Modifier.weight(1f))
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            OutlinedButton(
                onClick = onManualEntry,
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp),
                shape = RoundedCornerShape(6.dp),
            ) {
                Icon(Icons.Outlined.Keyboard, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("INGRESAR CÓDIGO", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            IconButton(
                onClick = onToggleTorch,
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(if (torchEnabled) LevitatePink else Color(0xFF303030)),
            ) {
                Icon(
                    imageVector = if (torchEnabled) Icons.Filled.FlashOn else Icons.Filled.FlashOff,
                    contentDescription = if (torchEnabled) "Apagar linterna" else "Encender linterna",
                    tint = Color.White,
                )
            }
        }
    }
}

@Composable
private fun SessionCounter(
    label: String,
    count: Int,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .border(1.dp, color.copy(alpha = 0.7f), RoundedCornerShape(6.dp))
            .padding(horizontal = 12.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = Color(0xFFBDBDBD), fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Text(count.toString(), color = color, fontSize = 19.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun CheckingOverlay() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.82f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = LevitatePink, strokeWidth = 4.dp)
            Spacer(Modifier.height(22.dp))
            Text("VALIDANDO BOLETO", color = Color.White, fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp)
        }
    }
}

@Composable
private fun DecisionScreen(
    decision: ScanDecision,
    onContinue: () -> Unit,
) {
    val background = if (decision.admitted) AccessGreen else RejectRed
    val title = when {
        decision.admitted -> "ACCESO VÁLIDO"
        decision.reason == "already_used" -> "YA UTILIZADO"
        decision.reason == "cancelled" -> "BOLETO CANCELADO"
        else -> "NO ADMITIR"
    }

    SignalDecision(decision.admitted)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(background)
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(horizontal = 28.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(0.5f))
        Icon(
            imageVector = if (decision.admitted) Icons.Filled.CheckCircle else Icons.Filled.Close,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(112.dp),
        )
        Spacer(Modifier.height(24.dp))
        Text(
            text = title,
            color = Color.White,
            fontSize = 37.sp,
            lineHeight = 40.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = decision.message,
            color = Color.White,
            fontSize = 19.sp,
            lineHeight = 26.sp,
            textAlign = TextAlign.Center,
        )

        decision.ticket?.let { ticket ->
            Spacer(Modifier.height(30.dp))
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color.White.copy(alpha = 0.55f), RoundedCornerShape(6.dp))
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Text(ticket.holderName, color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Bold)
                Text(ticket.label, color = Color.White.copy(alpha = 0.9f), fontSize = 16.sp)
                Text(ticket.code, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                if (!decision.admitted && ticket.usedAt != null) {
                    Text("Usado: ${ticket.usedAt}", color = Color.White.copy(alpha = 0.82f), fontSize = 13.sp)
                }
            }
        }

        Spacer(Modifier.weight(1f))
        Button(
            onClick = onContinue,
            modifier = Modifier
                .fillMaxWidth()
                .height(62.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = background),
            shape = RoundedCornerShape(6.dp),
        ) {
            Icon(Icons.Outlined.QrCodeScanner, contentDescription = null)
            Spacer(Modifier.width(10.dp))
            Text("ESCANEAR SIGUIENTE", fontWeight = FontWeight.Black, letterSpacing = 0.8.sp)
        }
    }
}

@Composable
private fun NetworkFailureScreen(
    message: String,
    onRetry: () -> Unit,
    onCancel: () -> Unit,
) {
    SignalDecision(admitted = false)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF7F1729))
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Outlined.WifiOff, contentDescription = null, tint = Color.White, modifier = Modifier.size(96.dp))
        Spacer(Modifier.height(24.dp))
        Text(
            "SIN CONEXIÓN\nNO ADMITIR",
            color = Color.White,
            fontSize = 36.sp,
            lineHeight = 41.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(18.dp))
        Text(message, color = Color.White, fontSize = 18.sp, lineHeight = 25.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(42.dp))
        Button(
            onClick = onRetry,
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color(0xFF7F1729)),
            shape = RoundedCornerShape(6.dp),
        ) {
            Icon(Icons.Outlined.Refresh, contentDescription = null)
            Spacer(Modifier.width(9.dp))
            Text("VOLVER A INTENTAR", fontWeight = FontWeight.Black)
        }
        TextButton(onClick = onCancel, modifier = Modifier.padding(top = 10.dp)) {
            Text("CANCELAR LECTURA", color = Color.White)
        }
    }
}

@Composable
private fun ManualTicketDialog(
    onDismiss: () -> Unit,
    onSubmit: (String) -> Unit,
) {
    var code by remember { mutableStateOf("") }
    val submit = { if (code.isNotBlank()) onSubmit(code) }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Outlined.ConfirmationNumber, contentDescription = null) },
        title = { Text("Ingresar boleto") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Usa esta opción sólo si la cámara no puede leer el QR.")
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it.uppercase() },
                    label = { Text("Código LV-...") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { submit() }),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            Button(onClick = submit, enabled = code.isNotBlank()) {
                Text("VALIDAR")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("CANCELAR")
            }
        },
    )
}

@Composable
private fun BrandLockup() {
    Row(verticalAlignment = Alignment.Bottom) {
        Text(
            text = "Levitate",
            color = Color.White,
            fontFamily = FontFamily.Serif,
            fontSize = 38.sp,
        )
        Spacer(Modifier.width(10.dp))
        Text(
            text = "ENTRADA",
            color = LevitatePink,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.8.sp,
            modifier = Modifier.padding(bottom = 7.dp),
        )
    }
}

@Composable
private fun SignalDecision(admitted: Boolean) {
    val context = LocalContext.current

    LaunchedEffect(admitted) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(VibratorManager::class.java).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        val pattern = if (admitted) longArrayOf(0, 90) else longArrayOf(0, 180, 90, 180)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern, -1)
        }

        val tone = ToneGenerator(AudioManager.STREAM_MUSIC, 90)
        tone.startTone(if (admitted) ToneGenerator.TONE_PROP_ACK else ToneGenerator.TONE_PROP_NACK, 260)
        delay(320)
        tone.release()
    }
}
