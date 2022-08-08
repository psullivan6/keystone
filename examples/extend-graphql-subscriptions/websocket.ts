import http from 'http';
import { useServer as wsUseServer } from 'graphql-ws/lib/use/ws';
import { WebSocketServer } from 'ws';
import { PubSub } from 'graphql-subscriptions';
import {
  CreateRequestContext,
  KeystoneGraphQLAPI,
  BaseKeystoneTypeInfo,
} from '@keystone-6/core/types';

async function onConnect(
  request: http.IncomingMessage,
  createRequestContext: CreateRequestContext<BaseKeystoneTypeInfo>
) {
  // @ts-expect-error CreateRequestContext requires `req` and `res` but only `req` is available here
  const context = await createRequestContext(request);

  // Check the user is authenticated (ie. they have a session)
  // Run any Checks on the session here, or remove this check if you don't need it
  if (!context.session) {
    throw new Error('Not authenticated');
  }
  console.log('onConnect', !!context.session);
}

// Setup pubsub as a Global variable in dev so it survives Hot Reloads.
declare global {
  var graphqlSubscriptionPubSub: PubSub;
}

// The 'graphql-subscriptions' pubsub library is not recommended for production use, but can be useful as an example
//   for details see https://www.apollographql.com/docs/apollo-server/data/subscriptions/#the-pubsub-class
export const pubSub = global.graphqlSubscriptionPubSub || new PubSub();
globalThis.graphqlSubscriptionPubSub = pubSub;

export const extendHttpServer = (
  httpServer: http.Server,
  createRequestContext: CreateRequestContext<BaseKeystoneTypeInfo>,
  graphqlSchema: KeystoneGraphQLAPI['schema']
): void => {
  // Setup WebSocket server using 'ws'
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/api/graphql',
  });

  // Setup the WebSocket to handle GraphQL subscriptions using 'graphql-ws'
  wsUseServer(
    {
      schema: graphqlSchema,
      // replace the 'graphql-ws' context with our Keystone context
      context: (ctx: any) => {
        // @ts-expect-error CreateRequestContext requires `req` and `res` but only `req` is available here
        return createRequestContext(ctx.extra.request);
      },

      // run these onConnect/onSubscribe functions as needed or remove them if you don't need them
      onConnect: async (ctx: any) => await onConnect(ctx.extra.request, createRequestContext),
      onSubscribe: async (ctx: any) => await onConnect(ctx.extra.request, createRequestContext),
    },
    wss
  );

  // Send the time every second as an interval example of pub/sub
  setInterval(() => {
    console.log('TIME', Date.now());
    pubSub.publish('TIME', {
      time: {
        iso: new Date().toISOString(),
      },
    });
  }, 1000);
};
