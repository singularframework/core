import { ServerConfig } from '../../../dist/core';

export const prodConfig: ServerConfig = {
  port: 5001,
  enableCors: true,
  tokenSecret: process.env.PIT_TOKEN_SECRET,
  tokenLifetime: 60 * 60
};
