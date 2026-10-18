# Mobile authentication

Mobile authentication connects signup/login/refresh/logout. Native builds store the
token pair in Expo SecureStore. Web uses `sessionStorage`: same-tab reloads restore
the session, closing the tab ends persistence, and tokens are accessible to page
scripts. Persistent browser sessions with HttpOnly cookies need a separate server
contract. Avoid duplicating an authenticated tab: browsers may copy sessionStorage,
and refresh-token reuse revokes the session.

Startup validates saved sessions with refresh before showing protected screens.
Connectivity failures preserve credentials and offer retry/logout. Refresh requests
are serialized and never automatically retried. A response lost after server-side
rotation may require login again. Logout clears local credentials and query caches
immediately, then attempts server revocation. If unreachable, the login screen warns
that the server session may remain until expiry. Storage deletion failure blocks
access and offers another logout attempt. Device-local diaries remain preserved;
their server migration/account ownership is tracked in [#71](https://github.com/LYJ0304/grow-together/issues/71)/[#72](https://github.com/LYJ0304/grow-together/issues/72).

For API URL and UI preview settings, see [mobile development](development.md).
