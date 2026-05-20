/**
 * GraphQL endpoint constants used across the app.
 */
export const GRAPHQL_ENDPOINTS = {
  pokeapi: "https://beta.pokeapi.co/graphql/v1beta",
  // Spec default is port 4000, but this workspace already has something on :4000.
  // Using 4100 keeps development unblocked; switch back to 4000 when needed.
  local: "http://localhost:4100/graphql",
} as const;
