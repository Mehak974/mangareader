const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../db');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Rate-limit OAuth callbacks and profile lookups; login redirect is exempt.
router.use('/me', rateLimit(60 * 1000, 30));
router.use('/logout', rateLimit(60 * 1000, 30));
router.use('/callback', rateLimit(60 * 1000, 10));

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. See backend/.env.example.');
}
const JWT_SECRET = process.env.JWT_SECRET;

const ANILIST_CLIENT_ID = process.env.ANILIST_CLIENT_ID;
const ANILIST_CLIENT_SECRET = process.env.ANILIST_CLIENT_SECRET;
const ANILIST_REDIRECT_URI = process.env.ANILIST_REDIRECT_URI;

function assertAniListConfig() {
  if (!ANILIST_CLIENT_ID || !ANILIST_CLIENT_SECRET || !ANILIST_REDIRECT_URI) {
    throw new Error('AniList OAuth is not configured. Set ANILIST_CLIENT_ID, ANILIST_CLIENT_SECRET, and ANILIST_REDIRECT_URI.');
  }
}

const ANILIST_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': `Mangareader.pro/${ANILIST_CLIENT_ID || '50507'} (+https://www.mangareader.pro)`,
  'Origin': 'https://anilist.co',
  'Referer': 'https://anilist.co/',
};

async function anilistPost(path, body) {
  const r = await axios.post(`https://anilist.co${path}`, body, { headers: ANILIST_HEADERS, timeout: 15000 });
  return r.data;
}

function anilistGraphQL(token, query, variables = {}) {
  return axios.post('https://graphql.anilist.co', { query, variables }, {
    headers: {
      ...ANILIST_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    timeout: 15000,
  });
}

function signAniListToken(userId) {
  return jwt.sign({ sub: userId, provider: 'anilist' }, JWT_SECRET, { expiresIn: '30d' });
}

function getAniListUserId(req) {
  const token = req.cookies?.anilist_session;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.provider === 'anilist' ? decoded.sub : null;
  } catch {
    return null;
  }
}

function setAniListCookie(res, userId) {
  const token = signAniListToken(userId);
  res.cookie('anilist_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });
}

function clearAniListCookie(res) {
  res.clearCookie('anilist_session', { path: '/' });
}

router.get('/anilist', (req, res) => {
  try {
    assertAniListConfig();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const url = new URL('https://anilist.co/api/v2/oauth/authorize');
  url.searchParams.set('client_id', ANILIST_CLIENT_ID);
  url.searchParams.set('redirect_uri', ANILIST_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  res.cookie('anilist_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/',
  });

  return res.redirect(url.toString());
});

router.get('/anilist/callback', async (req, res) => {
  try {
    assertAniListConfig();

    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    const savedState = req.cookies?.anilist_oauth_state;
    if (!savedState || state !== savedState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    const tokenData = await anilistPost('/api/v2/oauth/token', {
      grant_type: 'authorization_code',
      client_id: ANILIST_CLIENT_ID,
      client_secret: ANILIST_CLIENT_SECRET,
      redirect_uri: ANILIST_REDIRECT_URI,
      code,
    });

    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error('No access token in response');

    // Fetch the user's profile
    const userResp = await anilistGraphQL(accessToken, `
      query {
        Viewer {
          id
          name
          avatar { large medium }
        }
      }
    `);
    const viewer = userResp.data?.data?.Viewer;
    if (!viewer) throw new Error('Failed to fetch AniList user profile');

    const userId = String(viewer.id);
    const now = new Date();
    const expiresAt = tokenData.expires_in
      ? new Date(now.getTime() + tokenData.expires_in * 1000)
      : null;

    await db.query(
      `INSERT INTO anilist_users (id, name, avatar_url, access_token, token_type, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         avatar_url = EXCLUDED.avatar_url,
         access_token = EXCLUDED.access_token,
         token_type = EXCLUDED.token_type,
         expires_at = EXCLUDED.expires_at,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, viewer.name, viewer.avatar?.large || viewer.avatar?.medium || null, accessToken, tokenData.token_type || 'Bearer', expiresAt]
    );

    setAniListCookie(res, userId);
    res.clearCookie('anilist_oauth_state', { path: '/' });

    res.redirect('/');
  } catch (err) {
    console.error('[anilist/callback]', err.message);
    res.redirect('/?error=anilist_auth_failed');
  }
});

router.get('/anilist/me', async (req, res) => {
  const userId = getAniListUserId(req);
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const user = (await db.query('SELECT id, name, avatar_url, created_at, updated_at FROM anilist_users WHERE id = $1', [userId])).rows[0];
    if (!user) {
      clearAniListCookie(res);
      return res.status(401).json({ error: 'Session expired' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/anilist/logout', (req, res) => {
  clearAniListCookie(res);
  res.json({ success: true });
});

module.exports = router;
