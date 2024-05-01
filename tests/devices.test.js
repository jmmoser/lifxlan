import { describe, test } from 'node:test';
import assert from 'node:assert';
import { Devices } from '../src/devices.js';

describe('devices', () => {
  test('remove rejects resolvers', async () => {
    const devices = Devices();

    const promise = devices.get('test');

    

    // await Promise.all([
    //   new Promise((_, reject) => {
    //     setImmediate(reject);
    //   }),
    //   new Promise((resolve, reject) => {
    //     promise.catch()
    //   });
    // ]);
    // try {
    //   await promise;
    //   throw new Error('should have thrown');
    // } catch (err) {
    //   //
    // }
  });
});
