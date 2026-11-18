import { Outlet } from "react-router";
import { AppHeader } from "./AppHeader";

/** Header plus page content, for every logged-in route. */
export function AppShell() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </>
  );
}
