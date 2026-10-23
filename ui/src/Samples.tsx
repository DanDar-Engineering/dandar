import { useQuery } from "@apollo/client";
import { useState } from "react";
import { Button, Card } from "erxes-ui";
import { gql } from "~/gql";

const SAMPLES_QUERY = gql(`
  query dandarSamples($limit: Int!, $offset: Int!) {
    dandarSamples(limit: $limit, offset: $offset) {
      _id
      label
      createdAt
    }
  }
`);

const PAGE_SIZE = 20;

export const Samples = () => {
  const [offset, setOffset] = useState(0);
  const { data, loading, error, refetch } = useQuery(SAMPLES_QUERY, {
    variables: { limit: PAGE_SIZE, offset },
  });
  const records = data?.dandarSamples ?? [];

  return (
    <Card>
      <Card.Header>
        <Card.Title>Sample records</Card.Title>
        <Card.Description>
          Tenant-scoped data; requires the dandarSamplesRead permission.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {loading ? (
          <p role="status">Loading records…</p>
        ) : error ? (
          <div role="alert">
            <p>{error.message}</p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : records.length === 0 ? (
          <p>No sample records.</p>
        ) : (
          <ul>
            {records.map((record) => (
              <li key={record._id}>{record.label}</li>
            ))}
          </ul>
        )}
        <div className="dandar:mt-4 dandar:flex dandar:gap-2">
          <Button
            variant="outline"
            disabled={loading || offset === 0}
            onClick={() => setOffset(offset - PAGE_SIZE)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={loading || !!error || records.length < PAGE_SIZE || offset >= 10_000}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
};
