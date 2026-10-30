import { useState } from "react";
import { Link, navigate, useBodyClass, usePageTitle } from "../lib/router.jsx";
import { useAuth } from "../lib/auth.jsx";
import { cx } from "../lib/motion.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function AdminLoginPage() {
  useBodyClass("login-page");
  usePageTitle("GB Tech Corp | Admin Login");
  const { login } = useAuth();
  const [message, setMessage] = useState({ text: "", type: "" });
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await login(data.get("username"), data.get("password"));
      setMessage({ text: "Access granted. Opening your workspace...", type: "success" });
      navigate("/crm");
    } catch (error) {
      setMessage({ text: error.message, type: "error" });
      setBusy(false);
    }
  }

  return (
    <>
      <ThemeToggle floating />
      <main className="login-shell">
        <section className="login-card">
          <Link className="login-brand" to="/">
            <img className="brand-mark" src="/images/gb-tech-logo.png" alt="" />
            <div><strong>GB Tech Corp</strong><span>Admin workspace</span></div>
          </Link>
          <div className="login-header">
            <span className="eyebrow accent">Administrator access</span>
            <h1>Run the business clearly.</h1>
            <p>Sign in to manage leads, students, applications, tasks, and enquiries.</p>
          </div>
          <form className="portal-login-form" onSubmit={handleSubmit}>
            <label>Username<input name="username" type="text" autoComplete="username" required /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
            <button type="submit" className="btn btn-primary full-width" disabled={busy}>Sign in to admin</button>
            <p className={cx("login-message", message.type)} aria-live="polite">{message.text}</p>
          </form>
        </section>
      </main>
    </>
  );
}
