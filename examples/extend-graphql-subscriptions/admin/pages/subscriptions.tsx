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
const TIME = gql`
  subscription TIME {
    time {
      iso
    }
  }
`;
const PUBLISHED_POST = gql`
  subscription PUBLISHED_POST {
    postPublished {
      id
      title
      content
    }
  }
`;

const httpLink = new HttpLink({
  uri: `http://localhost:3000/api/graphql`,
});

const wsLink =
  typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: 'ws://localhost:3000/api/graphql',
        })
      )
    : httpLink;

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

  const { data: postData, loading: postLoading } = useSubscription(PUBLISHED_POST, {
    client: subClient,
    onSubscriptionData: ({ subscriptionData }) => {
      setPostRows([...postRows, JSON.stringify(subscriptionData.data.postPublished)]);
    },
  });

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
          <h4>Last Published Post Title</h4>
          <div>{!postLoading && postData?.postPublished?.title}</div>
          <h4>Published Post Feed</h4>
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
