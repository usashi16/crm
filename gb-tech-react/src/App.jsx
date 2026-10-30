import { useLayoutEffect, useEffect } from "react";
import { AuthProvider } from "./lib/auth.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import { Link, usePageTitle, usePathname } from "./lib/router.jsx";
import { motionAllowed } from "./lib/motion.js";
import HomePage from "./pages/HomePage.jsx";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import CrmPage from "./pages/CrmPage.jsx";

const routes = {
  "/": HomePage,
  "/admin-login": AdminLoginPage,
  "/crm": CrmPage,
};

function NotFoundPage() {
  usePageTitle("GB Tech Corp | Page not found");
  return (
    <main className="container section">
      <h1>Page not found</h1>
      <p>That page doesn’t exist. <Link to="/" className="crm-text-link">Back to the website</Link></p>
    </main>
  );
}

export default function App() {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  const Page = routes[pathname] || NotFoundPage;

  // Scroll reveal styles only apply once React is running, so content is never hidden without JS
  useLayoutEffect(() => {
    if (motionAllowed()) document.documentElement.classList.add("js-reveal");
  }, []);

  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <AuthProvider>
      <ToastProvider>
        <Page />
      </ToastProvider>
    </AuthProvider>
  );
}
