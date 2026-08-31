import React, { useMemo, useState } from "react";
import { changePassword, confirmPasswordReset, getStoredUser } from "./api";
import { AppHeader, AppFooter, PublicFooter } from "./components/AppChrome";

export default function ChangePasswordPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const resetMode = Boolean(uid && token);
  const user = getStoredUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function submit(e) {
    e.preventDefault(); setMessage(""); setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The passwords do not match.");
    setBusy(true);
    try {
      if (resetMode) {
        await confirmPasswordReset({ uid, token, password });
        sessionStorage.removeItem("niftybot_token");
        sessionStorage.removeItem("niftybot_user");
      } else {
        await changePassword({ current_password: currentPassword, new_password: password });
      }
      setCompleted(true);
      setMessage("Password verified and updated successfully.");
      return;
    } catch (err) {
      setError(err.response?.data?.detail || "Could not change the password.");
    } finally { setBusy(false); }
  }

  // Layout for when the user is not logged in (clicked a reset link from email)
  if (resetMode) {
    return (
      <>
        <AppHeader />
        <main className="auth-page auth-page-dark">
          <div className="auth-bg-orb auth-bg-orb-one" />
          <div className="auth-bg-orb auth-bg-orb-two" />
          <div className="auth-grid-glow" />

          <section className="auth-layout auth-layout-dark" style={{ justifyContent: "center" }}>
            <div className="auth-card auth-card-dark">
              <div className="auth-card-glow" />
              <div className="auth-card-top"><span className="auth-status-dot" /> Password recovery</div>

              {completed ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <h2 style={{ marginBottom: "10px" }}>Password updated</h2>
                  <p className="auth-subtitle" style={{ marginBottom: "25px" }}>Your password has been verified and changed successfully. You can now log in.</p>
                  <button type="button" className="auth-button auth-button-dark" onClick={() => { window.location.href = "/login"; }}>
                    Go to login <span>→</span>
                  </button>
                </div>
              ) : (
                <>
                  <h2>Set your password</h2>
                  <p className="auth-subtitle">Choose a new password for your Content Consult account.</p>
                  <form onSubmit={submit}>
                    <label>NEW PASSWORD
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required placeholder="At least 8 characters" />
                    </label>
                    <label>CONFIRM NEW PASSWORD
                      <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={8} required placeholder="Re-enter password" />
                    </label>
                    {error && <div className="auth-error auth-error-dark"><span>!</span><div>{error}</div></div>}
                    {message && <div className="auth-success auth-success-dark"><div>{message}</div></div>}
                    <button className="auth-button auth-button-dark" disabled={busy}>
                      {busy ? <><span className="button-spinner" /> Saving...</> : <>Save new password <span>→</span></>}
                    </button>
                  </form>
                </>
              )}

              <div className="auth-footer auth-footer-dark" style={{ marginTop: "30px", textAlign: "center" }}>
                <button type="button" className="auth-home-link auth-home-link-dark" onClick={() => { window.location.href = "/"; }}>← Back to home</button>
              </div>
            </div>
          </section>
        </main>
        <PublicFooter />
      </>
    );
  }

  // Layout for when the user is logged in (changing password from inside the app)
  return (
    <>
      <AppHeader subtitle="Account security" />
      <main className="drafts-page change-password-page">
        <section className="drafts-shell" style={{ maxWidth: "600px", margin: "40px auto" }}>
          <div className="drafts-heading" style={{ marginBottom: "25px" }}>
            <div>
              <div className="drafts-kicker">ACCOUNT SECURITY</div>
              <h1>Change password</h1>
              <p>Keep your account secure with a strong password.</p>
            </div>
          </div>

          <div style={{ background: "#fff", padding: "30px", borderRadius: "16px", border: "1px solid #dfeaf2", boxShadow: "0 14px 35px rgba(19,64,105,.04)" }}>
            {completed ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <h2 style={{ fontSize: "22px", color: "#143a5c", marginBottom: "10px" }}>Password updated</h2>
                <p style={{ color: "#54738c", fontSize: "14px", lineHeight: "1.6", marginBottom: "25px" }}>
                  Your password has been verified and changed successfully. Your new password is now active.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: "grid", gap: "18px" }}>
                <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: "750", color: "#54738c", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Current password
                  <input style={{ width: "100%", padding: "12px 14px", border: "1px solid #c9dae6", borderRadius: "10px", fontSize: "14px", color: "#143a5c", outline: "none", boxSizing: "border-box" }} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                </label>
                <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: "750", color: "#54738c", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  New password
                  <input style={{ width: "100%", padding: "12px 14px", border: "1px solid #c9dae6", borderRadius: "10px", fontSize: "14px", color: "#143a5c", outline: "none", boxSizing: "border-box" }} type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
                </label>
                <label style={{ display: "grid", gap: "6px", fontSize: "11px", fontWeight: "750", color: "#54738c", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Confirm new password
                  <input style={{ width: "100%", padding: "12px 14px", border: "1px solid #c9dae6", borderRadius: "10px", fontSize: "14px", color: "#143a5c", outline: "none", boxSizing: "border-box" }} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={8} required />
                </label>
                {error && <div style={{ background: "#fff5f5", color: "#c92a2a", padding: "12px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: "500", border: "1px solid #ffe3e3" }}>{error}</div>}
                {message && <div style={{ background: "#f1fbf5", color: "#2b8a3e", padding: "12px 14px", borderRadius: "10px", fontSize: "13px", fontWeight: "500", border: "1px solid #d3f9d8" }}>{message}</div>}
                <button style={{ background: "linear-gradient(135deg, #076ad4, #149df4)", color: "#fff", border: "1px solid #159cff", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", boxShadow: "0 8px 20px rgba(4,128,213,.2)", marginTop: "10px" }} disabled={busy}>
                  {busy ? "Saving…" : "Save new password"}
                </button>
              </form>
            )}
            <div style={{ marginTop: "25px", textAlign: "center" }}>
              <button type="button" className="auth-home-link" onClick={() => { window.location.href = "/"; }} style={{ background: "none", padding: "10px 18px", borderRadius: "8px", border: "1px solid #c9dae6", color: "#143a5c", cursor: "pointer", fontSize: "14px", fontWeight: "700" }}>← Back to home</button>
            </div>
          </div>
        </section>
        <AppFooter />
      </main>
    </>
  );
}
