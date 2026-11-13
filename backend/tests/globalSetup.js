import { execSync } from 'node:child_process';

// Runs once before the tests: creates the test database if needed and applies the migrations.
export default function setup(project) {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: project.config.env.DATABASE_URL },
    stdio: 'inherit',
  });
}
