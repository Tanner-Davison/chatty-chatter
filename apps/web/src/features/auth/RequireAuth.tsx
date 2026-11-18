import { Navigate, Outlet, useLocation } from "react-router";
import { LoadingBlock } from "../../components/ui";
import { SocketProvider } from "../chat/SocketProvider";
import { useMe } from "./api";

/** Renders child routes only for a logged-in user, with the chat socket available. */
export function RequireAuth() {
  const { data: user, isPending } = useMe();
  const location = useLocation();

  if (isPending) return <LoadingBlock />;
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return (
    <SocketProvider>
      <Outlet />
    </SocketProvider>
  );
}
