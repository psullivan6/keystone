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

  // TODO
  console.log('onConnect', !!context);
}

declare global {
  var graphqlSubscriptionPubSub: PubSub;
}

// this is not recommended for production use, but can be useful as an example
//   for details see https://www.apollographql.com/docs/apollo-server/data/subscriptions/#the-pubsub-class
export const pubSub = global.graphqlSubscriptionPubSub || new PubSub();
globalThis.graphqlSubscriptionPubSub = pubSub;

export const extendHttpServer = (
  httpServer: http.Server,
  createRequestContext: CreateRequestContext<BaseKeystoneTypeInfo>,
  graphqlSchema: KeystoneGraphQLAPI['schema']
): void => {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/api/graphql',
  });

  wsUseServer(
    {
      schema: graphqlSchema,

      // replace the graphql-ws context with our Keystone context
      context: (ctx: any) => {
        // @ts-expect-error CreateRequestContext requires `req` and `res` but only `req` is available here
        return createRequestContext(ctx.extra.request);
      },

      // run these onConnect/onSubscribe functions as needed
      onConnect: async (ctx: any) => await onConnect(ctx.extra.request, createRequestContext),
      onSubscribe: async (ctx: any) => await onConnect(ctx.extra.request, createRequestContext),
    },
    wss
  );

  // an interval example
  setInterval(() => {
    console.log('TIME', Date.now());
    pubSub.publish('TIME', {
      time: {
        iso: new Date().toISOString(),
      }
    });
  }, 1000);
};
