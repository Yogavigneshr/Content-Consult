import React from "react";
import Studio from "./Studio";
import HomePage from "./HomePage";
import ChangePasswordPage from "./ChangePasswordPage";
import LoginPage from "./LoginPage";
import AdminPage from "./AdminPage";
import DraftsPage from "./DraftsPage";
import { getStoredUser } from "./api";
import { ThemeProvider } from "./ThemeContext";

function AppRoutes() {
  const path = window.location.pathname;
  const user = getStoredUser();
  if (path === "/login") return <LoginPage />;
  if (path === "/change-password") {
    const params = new URLSearchParams(window.location.search);
    const hasResetToken = Boolean(params.get("uid") && params.get("token"));
    if (!user && !hasResetToken) { window.location.replace("/login"); return null; }
    return <ChangePasswordPage />;
  }
  if (path.startsWith("/admin")) {
    if (!user) { window.location.replace("/login"); return null; }
    if (!user.is_staff) { window.location.replace("/workspace"); return null; }
    return <AdminPage />;
  }
  if (path === "/drafts") {
    if (!user) { window.location.replace("/login"); return null; }
    return <DraftsPage />;
  }
  if (path === "/workspace") {
    if (!user) { window.location.replace("/login"); return null; }
    return <Studio />;
  }
  return <HomePage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  );
}
