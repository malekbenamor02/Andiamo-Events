import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: "/",

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

    plugins: [react()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    build: {
      outDir: "dist",
      assetsDir: "assets",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: undefined,
          entryFileNames: "assets/[name].[hash].js",
          chunkFileNames: "assets/[name].[hash].js",
          assetFileNames: "assets/[name].[hash].[ext]",
        },
      },
    },
  };
});
