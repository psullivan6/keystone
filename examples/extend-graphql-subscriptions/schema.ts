import { list, graphQLSchemaExtension } from '@keystone-6/core';
import { text } from '@keystone-6/core/fields';
import { pubSub } from './websocket';

import type { Lists } from '.keystone/types';

export const lists: Lists = {
  Post: list({
    fields: {
      title: text({ validation: { isRequired: true } }),
      content: text(),
    },
  }),
};

export const extendGraphqlSchema = graphQLSchemaExtension({
  typeDefs: `
    type Mutation {
      """ Publish a post """
      publishPost(id: ID!): Post
    }

    type Time {
      iso: String!
    }

    type Subscription {
      postPublished: Post
      time: Time
    }`,

  resolvers: {
    Mutation: {
      publishPost: async (root, { id }, context) => {
        // we use `context.db.Post`, not `context.query.Post`
        //   as this matches the type needed for GraphQL resolvers
        const post = context.db.Post.findOne({
          where: { id },
        });

        console.log('POST_PUBLISHED', { id });
        pubSub.publish('POST_PUBLISHED', {
          postPublished: post,
        });

        return post;
      },
    },

    // add the subscription resolvers
    Subscription: {
      time: {
        // @ts-ignore
        subscribe: () => pubSub.asyncIterator(['TIME']),
      },

      postPublished: {
        // @ts-ignore
        subscribe: () => pubSub.asyncIterator(['POST_PUBLISHED']),
      },
    },
  },
});
