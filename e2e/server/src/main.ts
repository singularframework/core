import { Singular } from '../../../dist/core';
import { devConfig } from './dev.config';
import { prodConfig } from './prod.config';
import { KebabCaseErrorCodesPlugin } from './plugins/kebab-case-error-codes.plugin';
import path from 'path';

// // Manual testing
// const paths = require(path.join(__dirname, '..', 'tsconfig.json')).compilerOptions.paths;
//
// for ( const aliases in paths ) {
//
//   paths[aliases] = paths[aliases].map(alias => path.join('..', alias).replace('src/', 'dist/'));
//
// }
//
// Singular
// .install(KebabCaseErrorCodesPlugin)
// .registerAliases(paths)
// .config('dev', { ...devConfig, consoleLogLevels: 'all' })
// .config('prod', { ...prodConfig, consoleLogLevels: 'all' })
// .launch();

export default () => {

  const paths = require(path.join(__dirname, '..', 'tsconfig.json')).compilerOptions.paths;

  // Sanitize paths
  for ( const aliases in paths ) {

    paths[aliases] = paths[aliases].map(alias => path.join('..', alias).replace('src/', 'dist/'));

  }

  return Singular
  .install(KebabCaseErrorCodesPlugin)
  .registerAliases(paths)
  .config('dev', Object.assign({}, devConfig, { tokenSecret: process.env.PIT_TOKEN_SECRET }))
  .config('prod', Object.assign({}, prodConfig, { tokenSecret: process.env.PIT_TOKEN_SECRET }))
  .launch();

};
