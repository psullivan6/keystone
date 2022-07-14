import { config } from '@keystone-6/core';
import { statelessSessions } from '@keystone-6/core/session';
import { createAuth } from '@keystone-6/auth';
import { lists } from './schema';
import { extendGraphqlSchema } from './custom-schema';
import { extendHttpServer } from './custom-websocket';

// Use keystone-6/auth for authentication https://keystonejs.com/docs/apis/auth
const { withAuth } = createAuth({
  listKey: 'Author',
  identityField: 'email',
  secretField: 'password',
  initFirstItem: {
    fields: ['name', 'email', 'password'],
  },
});

// Setup the session property - https://keystonejs.com/docs/apis/session
const session = statelessSessions({
  secret: '-- EXAMPLE COOKIE SECRET; CHANGE ME --',
  // Using `secure` and  `sameSite: 'none` so that apollo studio works for testing
  secure: true,
  sameSite: 'none',
});

export default withAuth(
  config({
    db: {
      provider: 'sqlite',
      url: process.env.DATABASE_URL || 'file:./keystone-example.db',
    },
    lists,
    session,
    server: {
      // Setting cors for apollo-studio for testing purposes as apollo playgroud does not support `graphql-ws` subscriptions
      cors: { origin: ['https://studio.apollographql.com'], credentials: true },
      // Call the extendHttpServer function to add support the WebSocketServer for subscriptions
      extendHttpServer,
    },
    // Call the extendGraphqlSchema function to add support for subscriptions to the graphql schema
    extendGraphqlSchema,
  })
);
