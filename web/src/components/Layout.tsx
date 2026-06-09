import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MouseAura, CursorRing } from "./MouseAura";

function Background() {
  return (
    <>
      <MouseAura />
      <CursorRing />
    </>
  );
}

export function Layout() {
  return (
    <div className="relative min-h-full flex flex-col">
      <Background />
      <div className="relative z-10 flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}

export function ChatLayout() {
  return (
    <div className="relative min-h-full flex flex-col">
      <Background />
      <div className="relative z-10 flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
