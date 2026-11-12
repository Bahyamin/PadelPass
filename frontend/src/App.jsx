import { useEffect, useState } from 'react';

export default function App() {
  const [health, setHealth] = useState('...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data.status))
      .catch(() => setHealth('unreachable'));
  }, []);

  return (
    <main>
      <h1>PadelPassTeam</h1>
      <p>
        API status: <span>{health}</span>
      </p>
    </main>
  );
}
