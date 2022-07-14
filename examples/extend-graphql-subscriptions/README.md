## Feature Example - Extend GraphQL Schema to enable subscriptions

This project demonstrates how to extend the GraphQL API provided by Keystone with custom queries, mutations and subscriptions with custom context and authentication. For more information on Subscriptions see https://www.apollographql.com/docs/apollo-server/data/subscriptions

## Instructions

To run this project, clone the Keystone repository locally, run `yarn` at the root of the repository then navigate to this directory and run:

```shell
yarn dev
```

This will start the Admin UI at [localhost:3000](http://localhost:3000).
You can use the Admin UI to create items in your database.

You can also access a GraphQL Playground at [localhost:3000/api/graphql](http://localhost:3000/api/graphql), which allows you to directly run GraphQL queries and mutations. To test out subscriptions use [Apollo Studio](https://studio.apollographql.com/sandbox/explorer/), in your connection settings, make sure `Subscription` is set to `ws://localhost:3000/api/graphql` and `Implementation` is `graphql-ws`. You can then subscribe to the `publishedPost` subscription by using the following, make sure you sign in to Keystone first:

```gql
subscription PublishedPost {
  postPublished {
    id
    publishDate
  }
}
```

Running the following mutation, replacing `ID_OF_YOUR_POST` with a valid post id, will then push the post to the subscription

```gql
mutation PublishPost {
  publishPost(id: "ID_OF_YOUR_POST") {
    id
    publishDate
  }
}
```

## Try it out in CodeSandbox 🧪

You can play with this example online in a web browser using the free [codesandbox.io](https://codesandbox.io/) service. To launch this example, open the URL <https://githubbox.com/keystonejs/keystone/tree/main/examples/extend-graphql-subscriptions>. You can also fork this sandbox to make your own changes.
