import { Link, useNavigate } from "react-router";
import { ArrowRight, Compass } from "lucide-react";
import { Button, Panel, PanelHeader } from "../../components/ui";
import { useDiscover } from "./api";
import { HubCard } from "./HubCard";

/** Dashboard section: the three hottest hubs you're not in, and a way to explore more. */
export function DiscoverTeaser() {
  const navigate = useNavigate();
  const { data = [] } = useDiscover({ sort: "trending" });
  const picks = data.filter((r) => r.membership === "none").slice(0, 3);

  return (
    <Panel className="p-4 sm:p-5">
      <PanelHeader
        title="Discover hubs"
        accent="public"
        actions={
          <Button variant="ghost" size="sm" onClick={() => void navigate("/explore")}>
            Explore all <ArrowRight className="size-4" />
          </Button>
        }
      />
      {picks.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-subtle">
          <Link to="/explore" className="text-primary hover:underline">
            <Compass className="mr-1 inline size-4" />
            Explore hubs
          </Link>{" "}
          to find somewhere new.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {picks.map((room) => (
            <HubCard
              key={room._id}
              room={room}
              onOpen={() => void navigate(`/explore?peek=${room.room_number}`)}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
