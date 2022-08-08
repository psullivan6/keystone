import React from 'react';
import { FieldProps } from '@keystone-6/core/types';
import { gql, useMutation } from '@keystone-6/core/admin-ui/apollo';
import { Button } from '@keystone-ui/button';
import { FieldContainer, FieldLabel } from '@keystone-ui/fields';
import { controller } from '@keystone-6/core/fields/types/json/views';

const PUBLISH_POST = gql`
  mutation PUBLISH_POST($id: ID!) {
    publishPost(id: $id) {
      id
      title
      content
    }
  }
`;

export const Field = ({ field, value }: FieldProps<typeof controller>) => {
  const [publishPost] = useMutation(PUBLISH_POST);

  return (
    <FieldContainer>
      <FieldLabel>{field.label}</FieldLabel>
      <Button onClick={() => publishPost({ variables: { id: value } })}>Publish Post</Button>
    </FieldContainer>
  );
};
