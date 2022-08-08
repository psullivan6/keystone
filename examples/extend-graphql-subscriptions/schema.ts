import { list, graphQLSchemaExtension, graphql } from '@keystone-6/core';
import { select, relationship, text, timestamp, password, virtual } from '@keystone-6/core/fields';
import { pubSub } from './websocket';

import type { Lists } from '.keystone/types';

export const lists: Lists = {
  Post: list({
    fields: {
      title: text({ validation: { isRequired: true } }),
      status: select({
        type: 'enum',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' },
        ],
      }),
      content: text(),
      publishDate: timestamp(),

      author: relationship({ ref: 'Author.posts', many: false }),
      publish: virtual({
        ui: {
          views: require.resolve('./fields/publish-post/components.tsx'),
          listView: { fieldMode: 'hidden' },
        },
        field: graphql.field({
          type: graphql.ID,
          resolve(item) {
            return item.id;
          },
        }),
      }),
    },
  }),

  Author: list({
    fields: {
      name: text({ validation: { isRequired: true } }),
      email: text({ isIndexed: 'unique', validation: { isRequired: true } }),
      posts: relationship({ ref: 'Post.author', many: true }),
      password: password(),
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
        const post = context.db.Post.updateOne({
          where: { id },
          data: { status: 'published', publishDate: new Date().toISOString() },
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
