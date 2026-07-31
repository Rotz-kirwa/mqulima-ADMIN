type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim().replace(/\/$/, ""))
  : [
      "https://www.mqulima.com",
      "https://mqulima.vercel.app",
      "https://mqulima-admin-tawny.vercel.app",
      "http://localhost:3000",
      "http://localhost:8080",
      "http://localhost:8081",
    ];

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const origin = request.headers.get("origin") || "";
    const normalizedOrigin = origin.replace(/\/$/, "");
    const isAllowed = ALLOWED_ORIGINS.includes(normalizedOrigin);

    if (request.method === "OPTIONS") {
      if (isAllowed) {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": normalizedOrigin,
            "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Cookie",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",
          },
        });
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);

      if (isAllowed) {
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Access-Control-Allow-Origin", normalizedOrigin);
        newHeaders.set("Access-Control-Allow-Credentials", "true");
        if (!newHeaders.has("Access-Control-Allow-Headers")) {
          newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Cookie");
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }

      return response;
    } catch (error) {
      console.error(error);
      const errorHeaders = new Headers({ "content-type": "text/plain; charset=utf-8" });
      if (isAllowed) {
        errorHeaders.set("Access-Control-Allow-Origin", normalizedOrigin);
        errorHeaders.set("Access-Control-Allow-Credentials", "true");
      }
      return new Response("Internal Server Error", {
        status: 500,
        headers: errorHeaders,
      });
    }
  },
};
