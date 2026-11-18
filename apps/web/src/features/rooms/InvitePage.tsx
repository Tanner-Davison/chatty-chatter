import { useEffect, useRef } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Link2Off } from "lucide-react";
import { Button, LoadingBlock, Panel } from "../../components/ui";
import { useAcceptInvite } from "./api";

/** Where invite links land: joins the hub, then opens it. */
export function InvitePage() {
  const code = useParams().code ?? "";
  const navigate = useNavigate();
  const accept = useAcceptInvite();
  const started = useRef(false);

  useEffect(() => {
    // Once per visit, even when effects run twice in development.
    if (started.current) return;
    started.current = true;
    accept.mutate(code);
  }, [accept, code]);

  if (accept.isSuccess) return <Navigate to={`/chatroom/${accept.data.room_number}`} replace />;
  if (!accept.isError) return <LoadingBlock label="Joining hub" />;

  return (
    <Panel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-5 p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger ring-1 ring-danger/40">
        <Link2Off className="size-6" />
      </span>
      <div>
        <h1 className="font-display text-2xl font-semibold">Invite didn't work</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {accept.error.message}. Ask whoever sent it for a fresh link.
        </p>
      </div>
      <Button onClick={() => void navigate("/currentservers")}>Back to your hubs</Button>
    </Panel>
  );
}
