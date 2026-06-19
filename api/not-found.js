import { sendJson } from "./_lib/http.js";

export default function handler(_req, res) {
  sendJson(res, 404, {
    error: {
      code: "not_found",
      message: "This Vercel project only serves backend API routes.",
    },
  });
}
