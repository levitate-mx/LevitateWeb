package mx.levitate.scanner.data

import mx.levitate.scanner.model.AttendanceEvent
import mx.levitate.scanner.model.AttendanceSnapshot
import mx.levitate.scanner.model.BlockAttendance
import org.json.JSONObject

/** Required counters must be present and integral, never optInt's implicit zero. */
internal object AttendanceParser {
    fun parse(json: JSONObject): AttendanceSnapshot {
        val blocks = json.getJSONArray("blocks")
        val events = json.getJSONArray("events")
        return AttendanceSnapshot(
            eventId = json.requiredText("eventId"),
            eventName = json.requiredText("eventName"),
            venue = json.requiredText("venue"),
            updatedAt = json.requiredText("updatedAt"),
            uniqueAdmissions = json.count("uniqueAdmissions"),
            blocks = (0 until blocks.length()).map { index ->
                val block = blocks.getJSONObject(index)
                BlockAttendance(
                    id = block.requiredText("id"), label = block.requiredText("label"),
                    dayId = block.requiredText("dayId"), date = block.requiredText("date"),
                    total = block.count("total"), single = block.count("single"),
                    day = block.count("day"), full = block.count("full"),
                )
            },
            events = (0 until events.length()).map { index ->
                val event = events.getJSONObject(index)
                AttendanceEvent(event.requiredText("id"), event.requiredText("name"))
            },
        )
    }

    private fun JSONObject.requiredText(key: String): String =
        (get(key) as? String)?.trim()?.takeIf(String::isNotBlank)
            ?: throw IllegalArgumentException("El campo $key del resumen no es válido.")

    private fun JSONObject.count(key: String): Long {
        val value = get(key)
        val count = when (value) {
            is Int -> value.toLong()
            is Long -> value
            else -> throw IllegalArgumentException("El contador $key no es válido.")
        }
        require(count >= 0)
        return count
    }
}
