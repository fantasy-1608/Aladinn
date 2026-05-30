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

// [H-06] SECURITY: Loại bỏ sign-mock.js khỏi bản build production
// Tránh lộ file mock có thể bị khai thác trong môi trường thực tế
const excludeSignMock = () => ({
  name: 'exclude-sign-mock',
  generateBundle(_options, bundle) {
    for (const fileName in bundle) {
      if (fileName.includes('sign-mock')) {
        delete bundle[fileName];
        console.log(`[Aladinn Build] 🚫 Excluded ${fileName} from production build`);
      }
    }
  }
});

export default defineConfig({
  base: '',
  plugins: [
    crx({ manifest }),
    fixJQueryExport(),
    excludeSignMock()
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
