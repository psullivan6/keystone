import { config } from '@keystone-6/core';
import { statelessSessions } from '@keystone-6/core/session';
import { createAuth } from '@keystone-6/auth';
import { lists, extendGraphqlSchema } from './schema';
import { extendHttpServer } from './websocket';

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
      extendHttpServer,
    },
    extendGraphqlSchema,
  })
);
