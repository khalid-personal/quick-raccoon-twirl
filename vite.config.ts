import { defineConfig, loadEnv, type Plugin } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

type ApiRequest = import('node:http').IncomingMessage & { body?: unknown };
type ApiResponse = import('node:http').ServerResponse & {
  status(code: number): ApiResponse;
  json(body: unknown): void;
};
type ApiHandler = (request: ApiRequest, response: ApiResponse) => Promise<unknown> | unknown;

const chechePayDevApi = (): Plugin => {
  const secretNames = [
    'CHECHE_SECRET_KEY',
    'CHECHE_FINANCE_BASE_URL',
    'CHECHE_APP_URL',
    'CHECHE_STAGE_FEES_JSON',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ];
  const handlers: Record<string, () => Promise<ApiHandler>> = {
    '/api/chechepay/initialize': async () => (await import('./api/chechepay/initialize')).default as ApiHandler,
    '/api/chechepay/verify': async () => (await import('./api/chechepay/verify')).default as ApiHandler,
  };

  return {
    name: 'dawm-chechepay-dev-api',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '');
      secretNames.forEach(name => {
        if (!process.env[name] && env[name]) process.env[name] = env[name];
      });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const route = request.url?.split('?')[0] ?? '';
        const loadHandler = handlers[route];
        if (!loadHandler) return next();
        const apiResponse = response as ApiResponse;
        apiResponse.status = code => { response.statusCode = code; return apiResponse; };
        apiResponse.json = body => {
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify(body));
        };
        if (request.method !== 'POST') {
          response.setHeader('Allow', 'POST');
          return apiResponse.status(405).json({ error: 'Method not allowed.' });
        }

        let body = '';
        request.setEncoding('utf8');
        request.on('data', chunk => { body += chunk; });
        request.on('end', () => {
          void (async () => {
            try {
              (request as ApiRequest).body = body ? JSON.parse(body) : {};
              const handler = await loadHandler();
              await handler(request as ApiRequest, apiResponse);
            } catch {
              if (!response.headersSent) apiResponse.status(400).json({ error: 'Invalid API request.' });
            }
          })();
        });
      });
    },
  };
};

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [dyadComponentTagger(), react(), chechePayDevApi()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
