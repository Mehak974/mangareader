'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ padding: '50px', color: 'red', fontSize: '30px', background: 'white' }}>
      <h1>ERROR CRASH!</h1>
      <pre>{error?.message}</pre>
      <button onClick={() => reset()}>Retry</button>
    </div>
  );
}
