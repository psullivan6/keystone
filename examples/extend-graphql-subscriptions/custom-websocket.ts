import http from 'http';
import { useServer as wsUseServer } from 'graphql-ws/lib/use/ws';
import { WebSocketServer } from 'ws';
import {
  CreateRequestContext,
  KeystoneGraphQLAPI,
  BaseKeystoneTypeInfo,
} from '@keystone-6/core/types';

class Forbidden extends Error {}

async function handleAuth(
  request: http.IncomingMessage,
  createRequestContext: CreateRequestContext<BaseKeystoneTypeInfo>
) {
  // Create a Keystone context for the request with the correct session context
  // @ts-expect-error CreateRequestContext requires `req` and `res` but only `req` is available here
  const context = await createRequestContext(request);
  // Get the session from the context
  const { session } = context;
  console.log('session', session);
  // If the is no session, throw an error, which blocks the operation
  // You can run any check on the session or check anything on the keystone context https://keystonejs.com/docs/apis/context
  if (!session) {
    // throw a custom error to be handled
    throw new Forbidden(':(');
  }
}

export const extendHttpServer = (
  server: http.Server,
  createRequestContext: CreateRequestContext<BaseKeystoneTypeInfo>,
  graphqlSchema: KeystoneGraphQLAPI['schema']
): void => {
  // Create a new WebSocket server on the existing keystone HTTP server
  const wss = new WebSocketServer({
    server: server,
    path: '/api/graphql',
  });

  // Use the WebSocket server to handle subscriptions
  wsUseServer(
    {
      // The keystone GraphQL schema for the websocket server to use
      schema: graphqlSchema,
      // Replace the graphql-ws inbuilt context with the Keystone context
      context: ctx => {
        // @ts-expect-error CreateRequestContext requires `req` and `res` but only `req` is available here
        return createRequestContext(ctx.extra.request);
      },
      // Run the handleAuth function before each subscription request to check if there is a valid session
      // If you don't want to check authentication, you can remove the `onConnect` and `onSubscribe` options
      onConnect: async ctx => await handleAuth(ctx.extra.request, createRequestContext),
      onSubscribe: async ctx => await handleAuth(ctx.extra.request, createRequestContext),
    },
    wss
  );
};
