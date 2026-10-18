// UI-only fixture for existing feature tests; auth-ui.mjs tests real route guards.
// Runs in the browser before hydration, without enabling the production bypass.
export function authenticatedSessionFixture() {
  const tokens = {
    accessToken: 'ui-test-access',
    refreshToken: 'ui-test-refresh',
    tokenType: 'Bearer',
    expiresIn: 900,
  };
  sessionStorage.setItem('growtogether.auth.v1', JSON.stringify(tokens));
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (
      new URL(String(input), location.href).pathname === '/api/v1/auth/refresh'
    ) {
      return Promise.resolve(
        new Response(JSON.stringify(tokens), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return originalFetch(input, init);
  };
}
