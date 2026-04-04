import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

// Fix: Vite wraps jQuery as ESM with 'export default', but Chrome content_scripts
// are classic scripts that don't support 'export'. Only strip from jQuery chunks.
const fixJQueryExport = () => ({
  name: 'fix-jquery-export',
  generateBundle(_options, bundle) {
    for (const fileName in bundle) {
      const chunk = bundle[fileName];
      if (chunk.type === 'chunk' && chunk.code.includes('jQuery')) {
        chunk.code = chunk.code.replace(/export\s+default\s+\w+\(\);?\s*$/m, '');
      }
    }
  }
});

export default defineConfig({
  base: '',
  plugins: [
    crx({ manifest }),
    fixJQueryExport()
  ],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  },
  build: {
    rollupOptions: {
      // Input ensures Vite bundles the extension properly
      input: {
        popup: 'popup/popup.html',
        options: 'options/options.html'
      }
    }
  }
});
