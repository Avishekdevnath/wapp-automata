import { createApplication } from './app';
import { rootLogger } from './logging';

export * from './app';

const logger = rootLogger.forModule('bootstrap');

// Process-level crash guards to ensure fault tolerance
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise rejection captured', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception captured', {
    error: err.message,
    stack: err.stack
  });
});

export async function main(): Promise<void> {
  try {
    const app = createApplication();
    await app.start();
  } catch (err) {
    logger.error('Fatal initialization error during main()', { error: err });
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}
