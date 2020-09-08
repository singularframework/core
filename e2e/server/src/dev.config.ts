import { ServerConfig } from '../../../dist/core';

export const devConfig: ServerConfig = {
  port: 5000,
  consoleLogLevels: 'all',
  logRequestHeaders: true,
  tokenSecret: process.env.PIT_TOKEN_SECRET,
  tokenLifetime: 60 * 60,
  excludeQueryParamsInLogs: ['token'],
  logResponseErrors: true
};
