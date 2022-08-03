/** @jsxRuntime classic */
/** @jsx jsx */
import { PageContainer } from '@keystone-6/core/admin-ui/components';
import { jsx, Heading } from '@keystone-ui/core';
import { createClient } from 'graphql-ws';
import { useEffect, useRef, useState } from 'react';
import { EventEmitter } from 'events';

// TODO: use Apollo, and subscribe to both event types
function connectWs (url: string) {
  const emitter: EventEmitter & { kill?: any } = new EventEmitter();
  const client = createClient({ url });
  client.subscribe(
    {
      query: `
        subscription Test {
          time {
            iso
          }
        }
      `,
    },
    {
      next: ({ data }: { data: any }) => emitter.emit('data', data),
      error: (err) => emitter.emit('error', err),
      complete: () => emitter.emit('end'),
    },
  );
  client.on('opened', () => emitter.emit('open'));
  client.on('closed', () => emitter.emit('close'));
  emitter.kill = () => client.dispose();
  return emitter;
}

export default function CustomPage() {
  const [rows, setRows] = useState([] as string[]);
  const ws = useRef<ReturnType<typeof connectWs> | null>(null);

  useEffect(() => {
    ws.current = connectWs('ws://127.0.0.1:3000/api/graphql');
    const thisws = ws.current;
    return () => thisws.kill();
  }, []);

  useEffect(() => {
    if (!ws.current) return;

    function append (row: string) {
      setRows([...rows, row]);
    }

    ws.current.on('open', () => append('> SOCKET OPEN'));
    ws.current.on('closed', () => append('> SOCKET CLOSED'));
    ws.current.on('end', () => append('> FIN'));
    ws.current.on('data', (data) => append(JSON.stringify(data)));
    ws.current.on('error', (err) => append(JSON.stringify(err)));

    const thisws = ws.current;
    return () => {
      thisws.removeAllListeners();
    };
  }, [rows, setRows]);

  return (
    <PageContainer header={<Heading type="h3">Subscriptions</Heading>}>
      <h3>Subscriptions Feed</h3>
      <div>
        {rows.map((row, i) => <div key={i}>{row}</div>)}
      </div>
    </PageContainer>
  );
}

