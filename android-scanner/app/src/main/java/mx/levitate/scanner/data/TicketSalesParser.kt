package mx.levitate.scanner.data

import mx.levitate.scanner.model.BlockTicketSales
import mx.levitate.scanner.model.TicketSalesSnapshot
import org.json.JSONObject

internal object TicketSalesParser {
    fun parse(json: JSONObject): TicketSalesSnapshot {
        val blocks = json.getJSONArray("blocks")
        return TicketSalesSnapshot(
            eventId = json.requiredText("eventId"),
            eventName = json.requiredText("eventName"),
            venue = json.requiredText("venue"),
            updatedAt = json.requiredText("updatedAt"),
            capacityPerBlock = json.count("capacityPerBlock"),
            uniqueTickets = json.count("uniqueTickets"),
            unassignedTickets = json.count("unassignedTickets"),
            blocks = (0 until blocks.length()).map { index ->
                val block = blocks.getJSONObject(index)
                BlockTicketSales(
                    id = block.requiredText("id"), label = block.requiredText("label"),
                    dayId = block.requiredText("dayId"), date = block.requiredText("date"),
                    total = block.count("total"), single = block.count("single"),
                    day = block.count("day"), full = block.count("full"),
                )
            },
        )
    }

    private fun JSONObject.requiredText(key: String): String =
        (get(key) as? String)?.trim()?.takeIf(String::isNotBlank)
            ?: throw IllegalArgumentException("El campo $key de ventas no es válido.")

    private fun JSONObject.count(key: String): Long {
        val value = get(key)
        val count = when (value) {
            is Int -> value.toLong()
            is Long -> value
            else -> throw IllegalArgumentException("El contador $key de ventas no es válido.")
        }
        require(count >= 0)
        return count
    }
}
