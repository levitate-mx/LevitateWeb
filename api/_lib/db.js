import { neon } from "@neondatabase/serverless";

import { getRequiredDatabaseUrl } from "./config.js";

let sqlClient;

export function sql() {
  if (!sqlClient) {
    sqlClient = neon(getRequiredDatabaseUrl());
  }

  return sqlClient;
}
