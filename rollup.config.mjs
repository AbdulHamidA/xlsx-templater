import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

// xlsxtemplater-dms is a Node-only package: a single CommonJS bundle.
// The upstream ESM and UMD (browser) builds were dropped together with the
// node-fetch dependency — image loading now uses global fetch / Buffer /
// AbortController (Node 18+) or the host's own imageLoader.
const external = [
  'exceljs',
  'lodash',
  'lodash/cloneDeep',
  'path',
  'fs',
  'url',
  'buffer',
  'stream',
  'string_decoder',
  'events',
  'util',
  'assert',
  'crypto'
];

export default [
  {
    input: 'src/XlsxTemplater.js',
    output: {
      file: 'dist/xlsxtemplater.cjs',
      format: 'cjs',
      exports: 'auto'
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: true,
        browser: false,
        extensions: ['.js', '.mjs', '.json']
      }),
      commonjs({
        ignoreDynamicRequires: true,
        transformMixedEsModules: true,
        include: /node_modules/
      }),
      json()
    ]
  }
];
