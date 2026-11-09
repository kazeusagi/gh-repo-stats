import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidReact } from '@void/react/plugin';

export default defineConfig({
  plugins: [voidPlugin(), voidReact({ react: { compiler: true } }), tailwindcss()],
  build: {
    // /:owner/:repo のページが /assets/xxx.css などの 2 階層の URL を受け取ってしまうので、
    // ビルド結果は 3 階層の URL で配信する
    assetsDir: '_app/assets',
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
