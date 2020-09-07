import { Singular } from '../../../dist/core';
import { devConfig } from './dev.config';
import { prodConfig } from './prod.config';
import { KebabCaseErrorCodesPlugin } from './plugins/kebab-case-error-codes.plugin';
import path from 'path';

const paths = require('../tsconfig.json').compilerOptions.paths;

// Sanitize paths
for ( const aliases in paths ) {

  paths[aliases] = paths[aliases].map(alias => path.join('..', alias).replace('src/', 'dist/'));

}

Singular
.install(KebabCaseErrorCodesPlugin)
.registerAliases(paths)
.config('dev', devConfig)
.config('prod', prodConfig)
.launch();
