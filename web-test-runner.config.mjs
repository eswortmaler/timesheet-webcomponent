import { esbuildPlugin } from '@web/dev-server-esbuild';
import { legacyPlugin } from '@web/dev-server-legacy';

export default {
  files: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
  plugins: [
    esbuildPlugin({ ts: true, target: 'auto' }),
    // make sure this plugin is always last
    legacyPlugin({
      polyfills: {
        webcomponents: true,
        // Inject lit's polyfill-support module into test files, which is required
        // for interfacing with the webcomponents polyfills
        custom: [
          {
            name: 'lit-polyfill-support',
            path: 'node_modules/lit/polyfill-support.js',
            test: "!('attachShadow' in Element.prototype)",
            module: false,
          },
        ],
      },
    }),],
};
