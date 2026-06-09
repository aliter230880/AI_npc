import { Route, Routes } from "react-router-dom";
import { Layout, ChatLayout } from "./components/Layout";
import { ToastProvider } from "./lib/toast";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Explore from "./pages/Explore";
import Dashboard from "./pages/Dashboard";
import Builder from "./pages/Builder";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login mode="login" />} />
          <Route path="/register" element={<Login mode="register" />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/builder/:id" element={<Builder />} />
        </Route>
        <Route element={<ChatLayout />}>
          <Route path="/chat/:id" element={<Chat />} />
        </Route>
        <Route path="*" element={<Layout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
