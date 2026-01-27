import { ref } from 'vue';

const stateKey = 'code_verifier';
const client_id: string = '43cee162706f463dbb62be67258fbe2f';
const redirect_uri: string = '0.0.0.0';

interface Song {
  album: { name: null | string },
  name: string,
  artists: [{ "name": "" }]
}

export function useSpotifyAuth() {
  const hasAccessToken = ref(!!localStorage.getItem('access_token'));

  /**
   * Generates a random string of specified length
   */
  function generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }

  /**
   * Hashes a string using SHA-256
   */
  const sha256 = async (plain: string) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    return globalThis.crypto.subtle.digest('SHA-256', data)
  }

  /**
   * Encodes an ArrayBuffer to base64url format
   */
  const base64encode = (input: ArrayBuffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /**
   * Extracts the parameters out of the redirected URI after Spotify login
   */
  function getHashParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const queryString = window.location.hash.substring(1) + '&' + window.location.search.substring(1);

    const regex = /([^&;=]+)=?([^&;]*)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(queryString))) {
      if (match[1] && match[2]) {
        params[match[1]] = decodeURIComponent(match[2]);
      }
    }

    return params;
  }

  /**
   * Exchanges authorization code for an access token
   */
  const getToken = async function (code: string) {
    if (!code) {
      console.error("No code provided for token exchange.");
      return;
    }

    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
      console.error("No code verifier found in local storage.");
      return;
    }

    const url = "https://accounts.spotify.com/api/token";
    const payload = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: client_id,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect_uri,
        code_verifier: codeVerifier,
      }),
    }

    const body = await fetch(url, payload);
    const response = await body.json();

    console.log("Response:", response);
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    localStorage.setItem('access_token_expiration',
      (Date.now() + response.expires_in * 1000).toString());
    if(response.access_token){
      hasAccessToken.value = true;
    }
  }

  const getRefreshToken = async function () {
    const refresh_token = localStorage.getItem('refresh_token');
    if (!refresh_token) {
      console.error("No refresh token found in local storage.");
      return;
    }

    const url = "https://accounts.spotify.com/api/token";
    const payload = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        client_id: client_id,
      }),
    }

    const body = await fetch(url, payload);
    const response = await body.json();

    console.log("Refresh Response:", response);
    if(response.error == "invalid_grant"){
      console.error("Refresh token is invalid. User needs to re-authenticate.");
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('access_token_expiration');
      redirectToSpotifyLogin();
      return;
    }
    
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('access_token_expiration',
      (Date.now() + response.expires_in * 1000).toString());
  }

  /**
   * Redirects user to Spotify login with PKCE flow
   */
  async function redirectToSpotifyLogin() {
    const codeVerifier = generateRandomString(64);
    localStorage.setItem(stateKey, codeVerifier);

    const hashed = await sha256(codeVerifier)
    const codeChallenge = base64encode(hashed);

    const scope = 'user-top-read';

    let url = 'https://accounts.spotify.com/authorize';
    url += '?response_type=code';
    url += '&client_id=' + encodeURIComponent(client_id);
    url += '&scope=' + encodeURIComponent(scope);
    url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
    url += '&code_challenge_method=' + 'S256';
    url += '&code_challenge=' + encodeURIComponent(codeChallenge);
    url += '&show_dialog=true';

    window.location.href = url;
  }

  /**
   * Fetches user's top songs from Spotify API
   */
  function fetchSongs(limit: number = 1): Promise<Song[]> {
    const headers = new Headers()
    headers.set('Authorization', 'Bearer ' + localStorage.getItem('access_token'))
    return fetch('https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=' + limit, { headers })
      .then(response => response.json())
      .then((data) => {
        return data.items as Song[];
      })
  }

  /**
   * Initialize auth on component mount
   */
  function initializeAuth() {
    if (localStorage.getItem('code_verifier') != null) {
      const params = getHashParams();
      console.log("Authenticated:", params);

      const access_token = localStorage.getItem('access_token');
      const access_token_expiration = Number(localStorage.getItem('access_token_expiration'));
      if (access_token != null) {
        console.log("Access token already exists:", access_token);
        if (access_token_expiration != null && access_token_expiration > Date.now()) {
          console.log("Access token is still valid.");
        } else {
          console.log("Access token has expired. Need to re-authenticate.");
          getRefreshToken();
        }
        hasAccessToken.value = true;
      } else {
        console.log("Exchanging code for access token...");
        getToken(params.code || '');
      }
    } else {
      console.log("Not authenticated");
    }
  }

  return {
    hasAccessToken,
    redirectToSpotifyLogin,
    fetchSongs,
    initializeAuth,
  };
}
