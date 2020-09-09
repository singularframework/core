import { ServerConfig } from '../../../dist/core';
import path from 'path';

export const prodConfig: ServerConfig = {
  https: true,
  httpsPort: 5001,
  httpsKey: path.join(__dirname, 'credentials', 'key.pem'),
  httpsCert: path.join(__dirname, 'credentials', 'cert.pem'),
  enableCors: true,
  consoleLogLevels: [], // Suppress console logs
  logRequestHeaders: true,
  tokenSecret: process.env.PIT_TOKEN_SECRET,
  tokenLifetime: 60 * 60,
  excludeQueryParamsInLogs: ['token'],
  logResponseErrors: true,
  sessionManagement: true
};
