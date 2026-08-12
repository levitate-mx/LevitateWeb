package mx.levitate.scanner.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val LevitatePink = Color(0xFFE64D92)
val LevitateBlack = Color(0xFF080808)
val LevitateInk = Color(0xFF202020)
val LevitatePaper = Color(0xFFF7F5F2)
val AccessGreen = Color(0xFF087A4B)
val RejectRed = Color(0xFFB81E3C)
val WarningAmber = Color(0xFFB96A0A)

private val scannerColors = darkColorScheme(
    primary = LevitatePink,
    onPrimary = Color.White,
    secondary = Color(0xFF75C7D5),
    onSecondary = LevitateInk,
    background = LevitateBlack,
    onBackground = LevitatePaper,
    surface = Color(0xFF151515),
    onSurface = LevitatePaper,
    error = RejectRed,
    onError = Color.White,
)

@Composable
fun LevitateTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = scannerColors,
        content = content,
    )
}

