// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/Users/ASUS/Andiamo-Events/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/ASUS/Andiamo-Events/node_modules/@vitejs/plugin-react-swc/index.mjs";
import { sentryVitePlugin } from "file:///C:/Users/ASUS/Andiamo-Events/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\ASUS\\Andiamo-Events";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: "/",
    server: {
      host: "::",
      port: 3e3,
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
                    error: "Backend server connection failed. Please ensure the server is running on port 8082.",
                    details: err.message
                  })
                );
              }
            });
            proxy.on("proxyReq", (proxyReq, req) => {
              console.log(
                `[Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`
              );
            });
          }
        }
      }
    },
    // ✅ server fully closed here
    plugins: [
      react(),
      ...env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT ? [
        sentryVitePlugin({
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          authToken: env.SENTRY_AUTH_TOKEN,
          sourcemaps: { assets: "./dist/assets" }
        })
      ] : [],
      {
        name: "favicon-rewrite",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === "/favicon.ico") req.url = "/logo.svg";
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      // Hidden source maps in production: .map files are generated for Sentry but not
      // linked in JS, so DevTools won't show original sources (like big platforms).
      sourcemap: mode === "production" ? "hidden" : true,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: void 0,
          entryFileNames: "assets/[name].[hash].js",
          chunkFileNames: "assets/[name].[hash].js",
          assetFileNames: "assets/[name].[hash].[ext]"
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBU1VTXFxcXEFuZGlhbW8tRXZlbnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxBU1VTXFxcXEFuZGlhbW8tRXZlbnRzXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9BU1VTL0FuZGlhbW8tRXZlbnRzL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgeyBzZW50cnlWaXRlUGx1Z2luIH0gZnJvbSBcIkBzZW50cnkvdml0ZS1wbHVnaW5cIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCBcIlwiKTtcblxuICByZXR1cm4ge1xuICAgIGJhc2U6IFwiL1wiLFxuXG4gICAgc2VydmVyOiB7XG4gICAgICBob3N0OiBcIjo6XCIsXG4gICAgICBwb3J0OiAzMDAwLFxuICAgICAgcHJveHk6IHtcbiAgICAgICAgXCIvYXBpXCI6IHtcbiAgICAgICAgICB0YXJnZXQ6IGVudi5WSVRFX0FQSV9UQVJHRVQgfHwgXCJodHRwOi8vbG9jYWxob3N0OjgwODJcIixcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmU6IChwcm94eSkgPT4ge1xuICAgICAgICAgICAgcHJveHkub24oXCJlcnJvclwiLCAoZXJyLCBfcmVxLCByZXMpID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlByb3h5IGVycm9yOlwiLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgIGlmIChyZXMgJiYgIXJlcy5oZWFkZXJzU2VudCkge1xuICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNTAwLCB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0pO1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoXG4gICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yOlxuICAgICAgICAgICAgICAgICAgICAgIFwiQmFja2VuZCBzZXJ2ZXIgY29ubmVjdGlvbiBmYWlsZWQuIFBsZWFzZSBlbnN1cmUgdGhlIHNlcnZlciBpcyBydW5uaW5nIG9uIHBvcnQgODA4Mi5cIixcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogZXJyLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBwcm94eS5vbihcInByb3h5UmVxXCIsIChwcm94eVJlcSwgcmVxKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICAgIGBbUHJveHldICR7cmVxLm1ldGhvZH0gJHtyZXEudXJsfSAtPiAke3Byb3h5UmVxLnBhdGh9YFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSwgLy8gXHUyNzA1IHNlcnZlciBmdWxseSBjbG9zZWQgaGVyZVxuXG4gICAgcGx1Z2luczogW1xuICAgICAgcmVhY3QoKSxcbiAgICAgIC4uLihlbnYuU0VOVFJZX0FVVEhfVE9LRU4gJiYgZW52LlNFTlRSWV9PUkcgJiYgZW52LlNFTlRSWV9QUk9KRUNUXG4gICAgICAgID8gW1xuICAgICAgICAgICAgc2VudHJ5Vml0ZVBsdWdpbih7XG4gICAgICAgICAgICAgIG9yZzogZW52LlNFTlRSWV9PUkcsXG4gICAgICAgICAgICAgIHByb2plY3Q6IGVudi5TRU5UUllfUFJPSkVDVCxcbiAgICAgICAgICAgICAgYXV0aFRva2VuOiBlbnYuU0VOVFJZX0FVVEhfVE9LRU4sXG4gICAgICAgICAgICAgIHNvdXJjZW1hcHM6IHsgYXNzZXRzOiBcIi4vZGlzdC9hc3NldHNcIiB9LFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXVxuICAgICAgICA6IFtdKSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogXCJmYXZpY29uLXJld3JpdGVcIixcbiAgICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgX3JlcywgbmV4dCkgPT4ge1xuICAgICAgICAgICAgaWYgKHJlcS51cmwgPT09IFwiL2Zhdmljb24uaWNvXCIpIHJlcS51cmwgPSBcIi9sb2dvLnN2Z1wiO1xuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdLFxuXG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IHtcbiAgICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICBidWlsZDoge1xuICAgICAgb3V0RGlyOiBcImRpc3RcIixcbiAgICAgIGFzc2V0c0RpcjogXCJhc3NldHNcIixcbiAgICAgIC8vIEhpZGRlbiBzb3VyY2UgbWFwcyBpbiBwcm9kdWN0aW9uOiAubWFwIGZpbGVzIGFyZSBnZW5lcmF0ZWQgZm9yIFNlbnRyeSBidXQgbm90XG4gICAgICAvLyBsaW5rZWQgaW4gSlMsIHNvIERldlRvb2xzIHdvbid0IHNob3cgb3JpZ2luYWwgc291cmNlcyAobGlrZSBiaWcgcGxhdGZvcm1zKS5cbiAgICAgIHNvdXJjZW1hcDogbW9kZSA9PT0gXCJwcm9kdWN0aW9uXCIgPyBcImhpZGRlblwiIDogdHJ1ZSxcbiAgICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICBtYW51YWxDaHVua3M6IHVuZGVmaW5lZCxcbiAgICAgICAgICBlbnRyeUZpbGVOYW1lczogXCJhc3NldHMvW25hbWVdLltoYXNoXS5qc1wiLFxuICAgICAgICAgIGNodW5rRmlsZU5hbWVzOiBcImFzc2V0cy9bbmFtZV0uW2hhc2hdLmpzXCIsXG4gICAgICAgICAgYXNzZXRGaWxlTmFtZXM6IFwiYXNzZXRzL1tuYW1lXS5baGFzaF0uW2V4dF1cIixcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE4USxTQUFTLGNBQWMsZUFBZTtBQUNwVCxPQUFPLFdBQVc7QUFDbEIsU0FBUyx3QkFBd0I7QUFDakMsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBS3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUUzQyxTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFFTixRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsVUFDTixRQUFRLElBQUksbUJBQW1CO0FBQUEsVUFDL0IsY0FBYztBQUFBLFVBQ2QsUUFBUTtBQUFBLFVBQ1IsSUFBSTtBQUFBLFVBQ0osV0FBVyxDQUFDLFVBQVU7QUFDcEIsa0JBQU0sR0FBRyxTQUFTLENBQUMsS0FBSyxNQUFNLFFBQVE7QUFDcEMsc0JBQVEsTUFBTSxnQkFBZ0IsSUFBSSxPQUFPO0FBQ3pDLGtCQUFJLE9BQU8sQ0FBQyxJQUFJLGFBQWE7QUFDM0Isb0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ3pELG9CQUFJO0FBQUEsa0JBQ0YsS0FBSyxVQUFVO0FBQUEsb0JBQ2IsT0FDRTtBQUFBLG9CQUNGLFNBQVMsSUFBSTtBQUFBLGtCQUNmLENBQUM7QUFBQSxnQkFDSDtBQUFBLGNBQ0Y7QUFBQSxZQUNGLENBQUM7QUFFRCxrQkFBTSxHQUFHLFlBQVksQ0FBQyxVQUFVLFFBQVE7QUFDdEMsc0JBQVE7QUFBQSxnQkFDTixXQUFXLElBQUksTUFBTSxJQUFJLElBQUksR0FBRyxPQUFPLFNBQVMsSUFBSTtBQUFBLGNBQ3REO0FBQUEsWUFDRixDQUFDO0FBQUEsVUFDSDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBO0FBQUEsSUFFQSxTQUFTO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixHQUFJLElBQUkscUJBQXFCLElBQUksY0FBYyxJQUFJLGlCQUMvQztBQUFBLFFBQ0UsaUJBQWlCO0FBQUEsVUFDZixLQUFLLElBQUk7QUFBQSxVQUNULFNBQVMsSUFBSTtBQUFBLFVBQ2IsV0FBVyxJQUFJO0FBQUEsVUFDZixZQUFZLEVBQUUsUUFBUSxnQkFBZ0I7QUFBQSxRQUN4QyxDQUFDO0FBQUEsTUFDSCxJQUNBLENBQUM7QUFBQSxNQUNMO0FBQUEsUUFDRSxNQUFNO0FBQUEsUUFDTixnQkFBZ0IsUUFBUTtBQUN0QixpQkFBTyxZQUFZLElBQUksQ0FBQyxLQUFLLE1BQU0sU0FBUztBQUMxQyxnQkFBSSxJQUFJLFFBQVEsZUFBZ0IsS0FBSSxNQUFNO0FBQzFDLGlCQUFLO0FBQUEsVUFDUCxDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFFQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDdEM7QUFBQSxJQUNGO0FBQUEsSUFFQSxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixXQUFXO0FBQUE7QUFBQTtBQUFBLE1BR1gsV0FBVyxTQUFTLGVBQWUsV0FBVztBQUFBLE1BQzlDLGFBQWE7QUFBQSxNQUNiLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLGNBQWM7QUFBQSxVQUNkLGdCQUFnQjtBQUFBLFVBQ2hCLGdCQUFnQjtBQUFBLFVBQ2hCLGdCQUFnQjtBQUFBLFFBQ2xCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
