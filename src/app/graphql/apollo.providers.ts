import { inject, Provider } from "@angular/core";
import { InMemoryCache } from "@apollo/client/core";
import { provideNamedApollo } from "apollo-angular";
import { HttpLink } from "apollo-angular/http";
import { GRAPHQL_ENDPOINTS } from "./graphql-endpoints";

/**
 * Provides two named Apollo clients:
 * - `pokeapi` for the public PokéAPI GraphQL endpoint (queries only)
 * - `local` for the local json-graphql-server endpoint (queries + mutations)
 *
 * Using named clients keeps caching and error handling concerns separated.
 */
export function provideGraphqlClients(): Provider {
  return provideNamedApollo(() => {
    const httpLink = inject(HttpLink);

    return {
      pokeapi: {
        cache: new InMemoryCache(),
        link: httpLink.create({ uri: GRAPHQL_ENDPOINTS.pokeapi }),
      },
      local: {
        cache: new InMemoryCache(),
        link: httpLink.create({ uri: GRAPHQL_ENDPOINTS.local }),
      },
    };
  });
}

