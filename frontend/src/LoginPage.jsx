import React, { useState } from 'react';
import { login, requestPasswordReset } from './api';
import { AppHeader, PublicFooter } from './components/AppChrome';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(identifier.trim(), password);
      window.location.href = data.user.is_staff ? '/admin' : '/workspace';
    } catch (err) {
      if (err.response) {
        // The server responded with an error (e.g. 400 = wrong credentials).
        setError(
          err.response?.data?.detail ||
            'Unable to sign in. Please check your credentials.'
        );
      } else {
        // No server response object means the request either never reached
        // the server correctly, or something failed client-side AFTER a
        // successful login (see api.js). Show the real reason instead of
        // wrongly blaming the user's credentials.
        console.error('Login failed unexpectedly:', err);
        setError(
          err.message ||
            'Something went wrong while signing you in. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AppHeader hideLogin={true} />
      <main className='auth-page auth-page-dark auth-home-visual'>
        <div className='auth-bg-orb auth-bg-orb-one' />
        <div className='auth-bg-orb auth-bg-orb-two' />
        <div className='auth-grid-glow' />

        <section className='auth-layout auth-layout-dark'>
          <div className='auth-intro auth-intro-dark'>
            <div className='auth-kicker auth-kicker-dark'>
              CONTENT WORKSPACE
            </div>
            <h1>
              <em>Content?</em>
              <br />
              when you are ready.
            </h1>
            <p>
              Find the right format, start with an idea, and turn it into
              finished content.
            </p>

            <div className='auth-points auth-points-dark'>
              <div>
                <b>01</b>
                <span>Website content &amp; landing pages</span>
              </div>
              <div>
                <b>02</b>
                <span>SEO blogs, articles &amp; guides</span>
              </div>
              <div>
                <b>03</b>
                <span>Social media, email &amp; campaign content</span>
              </div>
            </div>

            <div className='auth-visual-row'>
              <div className='auth-mini-card'>
                <div>
                  <strong>Smart creation</strong>
                  <small>Generate faster</small>
                </div>
              </div>
              <div className='auth-mini-card'>
                <div>
                  <strong>Organized drafts</strong>
                  <small>Everything in one place</small>
                </div>
              </div>
            </div>
          </div>

          <div className='auth-card auth-card-dark'>
            <div className='auth-card-glow' />
            <div className='auth-card-top'>
              <span className='auth-status-dot' />{' '}
              {mode === 'forgot' ? 'Password recovery' : 'Secure sign in'}
            </div>
            {mode === 'forgot' ? (
              <>
                <h2>Forgot password?</h2>
                <p className='auth-subtitle'>
                  Enter your account email and we’ll send you a secure
                  password-change link.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError('');
                    setForgotMessage('');
                    setLoading(true);
                    try {
                      const data = await requestPasswordReset(
                        forgotEmail.trim()
                      );
                      setForgotMessage(
                        data.detail ||
                          'If an account exists for that email, a password reset link has been sent.'
                      );
                    } catch (err) {
                      setError(
                        err.response?.data?.detail ||
                          'We could not send the password reset email right now.'
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <label>
                    EMAIL
                    <input
                      type='email'
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      autoComplete='email'
                      placeholder='Enter your account email'
                      required
                    />
                  </label>
                  {error && (
                    <div className='auth-error auth-error-dark'>
                      <span>!</span>
                      <div>{error}</div>
                    </div>
                  )}
                  {forgotMessage && (
                    <div className='auth-success auth-success-dark'>
                      <div>{forgotMessage}</div>
                    </div>
                  )}
                  <button
                    className='auth-button auth-button-dark'
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className='button-spinner' /> Sending...
                      </>
                    ) : (
                      <>
                        Send reset link <span>→</span>
                      </>
                    )}
                  </button>
                </form>
                <button
                  type='button'
                  className='auth-forgot-back'
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setForgotMessage('');
                  }}
                >
                  ← Back to login
                </button>
              </>
            ) : (
              <>
                <h2>Welcome back</h2>
                <p className='auth-subtitle'>
                  Sign in to continue to Content Consult.
                </p>

                <form onSubmit={submit}>
                  <label>
                    EMAIL OR USERNAME
                    <input
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete='username'
                      placeholder='Enter your email or username'
                      required
                    />
                  </label>

                  <label>
                    PASSWORD
                    <div className='password-wrap'>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete='current-password'
                        placeholder='Enter your password'
                        required
                      />
                      <button
                        type='button'
                        className='password-toggle'
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>

                  {error && (
                    <div className='auth-error auth-error-dark'>
                      <span>!</span>
                      <div>{error}</div>
                    </div>
                  )}

                  <button
                    className='auth-button auth-button-dark'
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className='button-spinner' /> Signing in...
                      </>
                    ) : (
                      <>
                        Sign in <span>→</span>
                      </>
                    )}
                  </button>
                </form>
                <button
                  type='button'
                  className='auth-forgot-link'
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setForgotMessage('');
                  }}
                >
                  Forgot password?
                </button>
              </>
            )}

            <div
              className='auth-footer auth-footer-dark'
              style={{ marginTop: '30px', textAlign: 'center' }}
            >
              <button
                type='button'
                className='auth-home-link auth-home-link-dark'
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                ← Back to home
              </button>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
