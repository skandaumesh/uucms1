import { Queue } from 'bullmq';
import redis from './redis';

export const syncQueue = new Queue('sync-queue', {
  connection: redis,
});

export const addSyncJob = async (type: string, data: any) => {
  await syncQueue.add(type, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
};
