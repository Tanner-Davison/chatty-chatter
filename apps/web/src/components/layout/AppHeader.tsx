import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import {
  Compass,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  PlusSquare,
  UserRound,
  X,
} from "lucide-react";
import { useLogout } from "../../features/auth/api";
import { useCurrentUser } from "../../features/auth/currentUser";
import { HubFinder } from "../../features/rooms/HubFinder";
import { NotificationBell } from "../../features/notifications/NotificationBell";
import { cn } from "../../lib/cn";
import { Avatar, Button, IconButton, Logo } from "../ui";

export function AppHeader() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: `/profile/${user.username}`, label: "Profile", icon: <UserRound /> },
    { to: "/currentservers", label: "Chat-Hubs", icon: <LayoutGrid /> },
    { to: "/explore", label: "Explore", icon: <Compass /> },
    { to: "/createroom", label: "Add-Hub", icon: <PlusSquare />, match: "/createroom" },
  ];

  const onLogout = () => logout.mutate(undefined, { onSettled: () => void navigate("/") });

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link to="/currentservers" className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <HeaderLink key={link.to} {...link} />
          ))}
        </nav>

        <HubFinder className="ml-auto hidden w-64 sm:block" />

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <NotificationBell />
          <Link to={`/profile/${user.username}`} aria-label="Your profile">
            <Avatar src={user.profilePic?.url} name={user.username} size="sm" ring="primary" />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            icon={<LogOut className="size-4" />}
            onClick={onLogout}
            loading={logout.isPending}
            className="hidden md:inline-flex"
          >
            Logout
          </Button>
          <IconButton
            label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden"
          >
            {menuOpen ? <X /> : <MenuIcon />}
          </IconButton>
        </div>
      </div>

      {menuOpen && (
        <nav
          aria-label="Main"
          className="animate-fade-up border-t border-line px-4 pb-4 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <HubFinder className="my-3 sm:hidden" />
          <div className="flex flex-col gap-1 pt-2">
            {links.map((link) => (
              <HeaderLink key={link.to} {...link} />
            ))}
            <Button
              variant="ghost"
              icon={<LogOut className="size-4" />}
              onClick={onLogout}
              className="justify-start"
            >
              Logout
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}

function HeaderLink({
  to,
  label,
  icon,
  match,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  match?: string;
}) {
  const { pathname } = useLocation();
  return (
    <NavLink
      to={to}
      className={({ isActive, isPending }) => {
        const active = isActive || isPending || (match ? pathname.startsWith(match) : false);
        return cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 font-display text-sm font-medium transition [&_svg]:size-4",
          active
            ? "bg-primary-soft text-primary"
            : "text-fg-muted hover:bg-surface-overlay hover:text-fg",
        );
      }}
    >
      {icon}
      {label}
    </NavLink>
  );
}
