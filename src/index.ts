import { createApplication } from './app';
import { rootLogger } from './logging';

export * from './app';

const logger = rootLogger.forModule('bootstrap');

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
