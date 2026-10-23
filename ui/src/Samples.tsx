import { useMutation, useQuery } from "@apollo/client";
import { type FormEvent, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
// Root imports on purpose: core-ui shares `erxes-ui`/`ui-modules` as Module
// Federation singletons keyed on the bare specifier.
import { Button, Card, Input, toast } from "erxes-ui";
import { CustomersInline, SelectCustomer } from "ui-modules";
import { gql } from "~/gql";

const SAMPLES_QUERY = gql(`
  query dandarSamples($limit: Int!, $offset: Int!) {
    dandarSamples(limit: $limit, offset: $offset) {
      _id
      label
      customerId
      createdAt
    }
  }
`);

const SAMPLE_ADD_MUTATION = gql(`
  mutation dandarSampleAdd($label: String!, $customerId: String) {
    dandarSampleAdd(label: $label, customerId: $customerId) {
      _id
    }
  }
`);

const PAGE_SIZE = 20;
// Mirrors LABEL_MAX_LENGTH in api/src/graphql/schema.ts.
const LABEL_MAX_LENGTH = 200;

// SelectCustomer and CustomersInline come from erxes's ui-modules: they read
// contacts from core through the host's Apollo client, so the plugin only
// stores the contact id.
const SampleForm = () => {
  const [label, setLabel] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [addSample, { loading }] = useMutation(SAMPLE_ADD_MUTATION, {
    // Refetch the list so the new record shows without a page reload.
    refetchQueries: ["dandarSamples"],
    awaitRefetchQueries: true,
    onCompleted: () => {
      setLabel("");
      setCustomerId("");
      toast({ title: "Record added", variant: "success" });
    },
    onError: (error) => {
      toast({
        title: "Could not add the record",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const name = label.trim();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name) {
      addSample({ variables: { label: name, customerId: customerId || null } });
    }
  };

  return (
    <form
      className="dandar:flex dandar:flex-col dandar:gap-2 dandar:md:flex-row dandar:md:items-center"
      onSubmit={onSubmit}
    >
      <Input
        aria-label="Record label"
        placeholder="Label"
        value={label}
        maxLength={LABEL_MAX_LENGTH}
        onChange={(event) => setLabel(event.target.value)}
      />
      <SelectCustomer
        mode="single"
        value={customerId || undefined}
        onValueChange={(value) => setCustomerId(Array.isArray(value) ? (value[0] ?? "") : value)}
        className="dandar:md:w-64"
      />
      <Button type="submit" disabled={loading || !name}>
        <IconPlus />
        {loading ? "Adding…" : "Add"}
      </Button>
    </form>
  );
};

export const Samples = () => {
  const [offset, setOffset] = useState(0);
  const { data, loading, error, refetch } = useQuery(SAMPLES_QUERY, {
    variables: { limit: PAGE_SIZE, offset },
  });
  const records = data?.dandarSamples ?? [];

  return (
    <Card>
      <Card.Header>
        <Card.Title>Records</Card.Title>
        <Card.Description>
          Plugin-owned data linked to erxes contacts. Add contacts in erxes Contacts, then pick one
          here.
        </Card.Description>
      </Card.Header>
      <Card.Content className="dandar:flex dandar:flex-col dandar:gap-4">
        <SampleForm />
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
          <p className="dandar:text-sm dandar:text-muted-foreground">No records yet.</p>
        ) : (
          <ul className="dandar:divide-y dandar:divide-border">
            {records.map((record) => (
              <li
                key={record._id}
                className="dandar:flex dandar:items-center dandar:justify-between dandar:gap-4 dandar:py-2 dandar:text-sm"
              >
                <span>{record.label}</span>
                {record.customerId ? (
                  <CustomersInline customerIds={[record.customerId]} />
                ) : (
                  <span className="dandar:text-muted-foreground">No contact</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="dandar:flex dandar:gap-2">
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
