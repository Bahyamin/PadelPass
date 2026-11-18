import app from './app.js';
import { config } from './config/index.js';

// Without a secret, tokens could not be signed: refuse to start.
if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is not set (see backend/.env.example)');
}

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
