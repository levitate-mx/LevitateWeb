export function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function getRequiredDatabaseUrl() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    const error = new Error("Missing DATABASE_URL or POSTGRES_URL");
    error.statusCode = 500;
    error.code = "missing_database_url";
    throw error;
  }

  return databaseUrl;
}

export function getWebhookSecret() {
  return process.env.CODI_WEBHOOK_SECRET || "";
}

export function getProviderName() {
  return process.env.CODI_PROVIDER || "mock";
}

export function getPublicSiteUrl(req) {
  if (process.env.PUBLIC_SITE_URL) {
    return process.env.PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const host = req?.headers?.host;
  const forwardedProto = req?.headers?.["x-forwarded-proto"];
  const isLocal = host?.startsWith("localhost") || host?.startsWith("127.0.0.1");
  const protocol = forwardedProto || (isLocal ? "http" : "https");

  return host ? `${protocol}://${host}` : "http://localhost:5173";
}
