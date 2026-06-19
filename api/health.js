import { sql } from "./_lib/db.js";
import { assertMethod, sendError, sendJson } from "./_lib/http.js";

export default async function handler(req, res) {
  try {
    assertMethod(req, ["GET"]);
    const db = sql();
    const [result] = await db`SELECT now() AS now`;
    sendJson(res, 200, {
      ok: true,
      database: "connected",
      now: result.now,
    });
  } catch (error) {
    sendError(res, error);
  }
}
