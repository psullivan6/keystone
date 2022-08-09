/** @jsxRuntime classic */
/** @jsx jsx */
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { jsx, Heading } from '@keystone-ui/core';
import {
  ApolloClient,
  gql,
  InMemoryCache,
  useSubscription,
  HttpLink,
} from '@keystone-6/core/admin-ui/apollo';
import { createClient } from 'graphql-ws';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { css } from '@emotion/css';

import { useState } from 'react';

const styles = {
  container: css`
    display: flex;
    height: 100%;
  `,
  feed: css`
    flex: 1;
    overflow-y: scroll;
    padding: 1rem;
  `,
};
// Setup the TIME subscription
const TIME = gql`
  subscription TIME {
    time {
      iso
    }
  }
`;

// Setup the Post subscription
const POST_UPDATED = gql`
  subscription POST_UPDATED {
    postUpdated {
      id
      title
      content
    }
  }
`;
// Setup a backup http link for Apollo
const httpLink = new HttpLink({
  uri: `http://localhost:3000/api/graphql`,
});

// Setup the WebSocket link for Apollo
// NOTE: to stop Next.js SSR from breaking, we need to check if window is defined
//  and if not, we use the 'httpLink' instead
const wsLink =
  typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: 'ws://localhost:3000/api/graphql',
        })
      )
    : httpLink;

// Setup the Apollo client for subscriptions
const subClient = new ApolloClient({
  link: wsLink,
  cache: new InMemoryCache(),
});

export default function CustomPage() {
  const [timeRows, setTimeRows] = useState([] as string[]);
  const [postRows, setPostRows] = useState([] as string[]);
  function appendTime(row: string) {
    setTimeRows([...timeRows, row]);
  }

  // Subscribe to the `postPublished` subscription using the Apollo client created above
  const { data: postData, loading: postLoading } = useSubscription(POST_UPDATED, {
    client: subClient,
    onSubscriptionData: ({ subscriptionData }) => {
      setPostRows([...postRows, JSON.stringify(subscriptionData.data.postUpdated)]);
    },
  });
  // Subscribe to the `time` subscription using the Apollo client created above
  const { data, loading } = useSubscription(TIME, {
    client: subClient,
    onSubscriptionData: ({ subscriptionData }) => {
      appendTime(JSON.stringify(subscriptionData.data.time));
    },
  });

  return (
    <PageContainer header={<Heading type="h3">Subscriptions</Heading>}>
      <div className={styles.container}>
        <div className={styles.feed}>
          <h4> Current Time </h4>
          <div>
            {!loading &&
              new Date(data?.time?.iso).toLocaleDateString() +
                ' ' +
                new Date(data?.time?.iso).toLocaleTimeString()}
          </div>
          <h4>Raw Time Feed</h4>
          <div>
            {timeRows.map((row, i) => (
              <div key={i}>{row}</div>
            ))}
          </div>
        </div>
        <div className={styles.feed}>
          <h4>Last Updated Post Title</h4>
          <div>{!postLoading && postData?.postUpdated?.title}</div>
          <h4>Updated Post Feed</h4>
          <div>
            {postRows.map((row, i) => (
              <div key={i}>{row}</div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
