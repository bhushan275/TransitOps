import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

async function main() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`\n🚚 TransitOps API listening on http://localhost:${env.PORT}`);
    console.log(`   Health:   http://localhost:${env.PORT}/api/health`);
    console.log(`   CORS for: ${env.CORS_ORIGIN}\n`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
