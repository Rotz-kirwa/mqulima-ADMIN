import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import { generateCsrfToken } from "../lib/csrf";

import appCss from "../styles.css?url";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gray-850">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-gray-800">Page not found</h2>
        <p className="mt-2 text-sm text-gray-500">
          The requested admin page does not exist.
        </p>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-gray-800">
          Admin Console Error
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {error.message || "An unexpected error occurred in the Admin panel."}
        </p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mqulima Admin Console" },
      { name: "theme-color", content: "#2D6A4F" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { useEffect } from "react";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Generate CSRF token on app initialization
    const initCsrf = async () => {
      try {
        await generateCsrfToken();
      } catch (err) {
        console.error("Failed to generate CSRF token:", err);
      }
    };
    initCsrf();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col w-full bg-[#F7F7F5]">
        <Outlet />
        <Toaster richColors position="top-right" />
      </div>
    </QueryClientProvider>
  );
}
