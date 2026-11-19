import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from "react-router";
import { AppShell } from "./components/layout/AppShell";
import { LoadingBlock } from "./components/ui";
import {
  ResetPasswordPage,
  UnsubscribePage,
  VerifyEmailPage,
} from "./features/auth/AccountLinkPages";
import { LoginPage } from "./features/auth/LoginPage";
import { RequireAuth } from "./features/auth/RequireAuth";
import { ChatPage } from "./features/chat/ChatPage";
import { ExplorePage } from "./features/explore/ExplorePage";
import { NotificationsPage } from "./features/notifications/NotificationsPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { CreateRoomPage } from "./features/rooms/CreateRoomPage";
import { InvitePage } from "./features/rooms/InvitePage";
import { RoomsPage } from "./features/rooms/RoomsPage";
import { isStatus } from "./lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry requests the server rejected on purpose.
      retry: (count, err) =>
        count < 2 && !isStatus(err, 401) && !isStatus(err, 403) && !isStatus(err, 404),
    },
  },
});

// The design system reference page only exists in development builds.
const DesignSystemPage = import.meta.env.DEV
  ? lazy(() =>
      import("./features/design/DesignSystemPage").then((m) => ({ default: m.DesignSystemPage })),
    )
  : null;

const routes: RouteObject[] = [
  { path: "/", element: <LoginPage /> },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/unsubscribe", element: <UnsubscribePage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/currentservers", element: <RoomsPage /> },
          { path: "/explore", element: <ExplorePage /> },
          { path: "/notifications", element: <NotificationsPage /> },
          { path: "/chatroom/:room", element: <ChatPage /> },
          { path: "/profile/:username", element: <ProfilePage /> },
          { path: "/createroom", element: <CreateRoomPage /> },
          // Old links carried a hub number; it is ignored now.
          { path: "/createroom/:room", element: <CreateRoomPage /> },
          { path: "/invite/:code", element: <InvitePage /> },
        ],
      },
    ],
  },
  ...(DesignSystemPage
    ? [
        {
          path: "/design",
          element: (
            <Suspense fallback={<LoadingBlock />}>
              <DesignSystemPage />
            </Suspense>
          ),
        },
      ]
    : []),
  { path: "*", element: <Navigate to="/" replace /> },
];

const router = createBrowserRouter(routes);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
