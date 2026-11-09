import { defineConfig } from 'void/config';

export default defineConfig({
  sourceDir: 'src',
  routing: { typedRoutes: true },
  worker: { compatibility_date: '2026-02-24' },
  cloudflare: {
    routes: [{ pattern: 'ghrepostats.kazeusagi.dev', custom_domain: true }],
  },
  head: {
    titleTemplate: '%s · repo-stats',
    htmlAttrs: { lang: 'ja', class: 'dark' },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'description', content: 'GitHub リポジトリの貢献者ランキング・AI 支援率・npm ダウンロード数を可視化' },
    ],
    link: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap',
      },
    ],
    script: [
      // 初回描画の前にテーマを反映してちらつきを防ぐ
      {
        innerHTML:
          "try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.remove('dark')}catch(e){}",
      },
    ],
  },
});
