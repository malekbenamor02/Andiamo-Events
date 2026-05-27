import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Only upload Sentry sourcemaps on Vercel production deploys. Preview/branch
  // deploys skip the upload entirely so they're fast; local prod builds also skip
  // unless explicitly opted-in via VERCEL_ENV=production.
  const isProdDeploy =
    mode === "production" && process.env.VERCEL_ENV === "production";

  const wantSentrySourcemaps =
    isProdDeploy &&
    Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);

  return {
    base: "/",

    esbuild: {
      // Production: remove console/debugger from shipped JS (Console tab stays clean).
      drop: mode === "production" ? ["console", "debugger"] : [],
    },

    server: {
      host: "::",
      port: 3000,
      proxy: {
        "/api": {
          target: env.VITE_API_TARGET || "http://localhost:8082",
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            proxy.on("error", (err, _req, res) => {
              console.error("Proxy error:", err.message);
              if (res && !res.headersSent) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    error:
                      "Backend server connection failed. Please ensure the server is running on port 8082.",
                    details: err.message,
                  })
                );
              }
            });

            proxy.on("proxyReq", (proxyReq, req) => {
              console.log(
                `[Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`
              );
            });
          },
        },
      },
    }, // ✅ server fully closed here

    plugins: [
      react(),
      ...(wantSentrySourcemaps
        ? [
            sentryVitePlugin({
              org: env.SENTRY_ORG,
              project: env.SENTRY_PROJECT,
              authToken: env.SENTRY_AUTH_TOKEN,
              telemetry: false,
              sourcemaps: {
                assets: "./dist/assets/**/*.js.map",
                filesToDeleteAfterUpload: "./dist/assets/**/*.js.map",
              },
              release: { create: false, finalize: false },
            }),
          ]
        : []),
      {
        name: "favicon-rewrite",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === "/favicon.ico") req.url = "/logo.svg";
            next();
          });
        },
      },
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    // @ffmpeg/ffmpeg spawns ./worker.js relative to import.meta.url; pre-bundling into
    // node_modules/.vite/deps breaks that path (missing worker.js in deps). Keep it external.
    optimizeDeps: {
      exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
    },

    build: {
      outDir: "dist",
      assetsDir: "assets",
      // Only emit .map files when Sentry upload runs; otherwise skip maps so
      // /assets/*.map is never deployed (avoids reconstructing original TS/TSX).
      // When Sentry runs: "hidden" = maps exist for upload but no sourceMappingURL in JS.
      sourcemap: mode === "production" ? (wantSentrySourcemaps ? "hidden" : false) : true,
      emptyOutDir: true,
      // Skip gzip-size reporting on every chunk (saves several seconds on big bundles).
      reportCompressedSize: false,
      target: "es2020",
      rollupOptions: {
        output: {
          // Explicit vendor splitting: smaller initial chunks, better browser caching
          // across deploys, and faster Rollup since chunks are independent.
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            query: ["@tanstack/react-query"],
            radix: [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-aspect-ratio",
              "@radix-ui/react-avatar",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-collapsible",
              "@radix-ui/react-context-menu",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-hover-card",
              "@radix-ui/react-label",
              "@radix-ui/react-menubar",
              "@radix-ui/react-navigation-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-progress",
              "@radix-ui/react-radio-group",
              "@radix-ui/react-scroll-area",
              "@radix-ui/react-select",
              "@radix-ui/react-separator",
              "@radix-ui/react-slider",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast",
              "@radix-ui/react-toggle",
              "@radix-ui/react-toggle-group",
              "@radix-ui/react-tooltip",
            ],
            charts: ["recharts"],
            icons: ["lucide-react"],
            sentry: ["@sentry/react"],
            forms: ["react-hook-form", "@hookform/resolvers", "zod"],
            animation: ["gsap", "embla-carousel-react"],
          },
          // Production: hash-only names so DevTools/Network do not expose module paths
          // (e.g. adminLogs, api-client). Development keeps [name] for easier debugging.
          ...(mode === "production"
            ? {
                entryFileNames: "assets/[hash].js",
                chunkFileNames: "assets/[hash].js",
                assetFileNames: "assets/[hash][extname]",
              }
            : {
                entryFileNames: "assets/[name].[hash].js",
                chunkFileNames: "assets/[name].[hash].js",
                assetFileNames: "assets/[name].[hash].[ext]",
              }),
        },
      },
    },
  };
});
