const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Constantes de la API De'Longhi/Ayla Networks (del cliente Python)
const SDK_BUILD = 16650;
const API_KEY = '3_e5qn7USZK-QtsIso1wCelqUKAK_IVEsYshRIssQ-X-k55haiZXmKWDHDRul2e5Y2';
const CLIENT_ID = '1S8q1WJEs-emOB43Z0-66WnL';
const CLIENT_SECRET = 'lmnceiD0B-4KPNN5ZS6WuWU70j9V5BCuSlz2OPsvHkyLryhMkJkPvKsivfTq3RfNYj8GpCELtOBvhaDIzKcBtg';
const AUTHORIZATION_HEADER = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
const APP_ID = 'DeLonghiComfort2-mw-id';
const APP_SECRET = 'DeLonghiComfort2-Yg4miiqiNcf0Or-EhJwRh7ACfBY';

const BROWSER_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/79.0.3945.73 Mobile/15E148 Safari/604.1';
const TOKEN_USER_AGENT = 'DeLonghiComfort/3 CFNetwork/1568.300.101 Darwin/24.2.0';
const API_USER_AGENT = 'DeLonghiComfort/5.1.1 (iPhone; iOS 18.2; Scale/3.00)';

const AYLA_BASE_URL = 'https://ads-eu.aylanetworks.com/';
const AYLA_USER_URL = 'https://user-field-eu.aylanetworks.com/';

const REFRESH_TOKEN_FILE = path.join(__dirname, 'refresh_token.txt');

// Estado global para almacenar tokens
let authState = {
  aylaToken: null,
  refreshToken: null,
  devices: [],
  expiresAt: null
};

// Headers comunes para Ayla
const getAylaHeaders = () => ({
  'User-Agent': API_USER_AGENT,
  'Authorization': `auth_token ${authState.aylaToken}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
});

// Utility to extract URL parameter
function getQueryParam(url, param) {
  const urlObj = new URL(url, 'http://dummy.com');
  return urlObj.searchParams.get(param);
}

// Guardar/cargar refresh token
function saveRefreshToken(token) {
  fs.writeFileSync(REFRESH_TOKEN_FILE, token);
}

function loadRefreshToken() {
  try {
    if (fs.existsSync(REFRESH_TOKEN_FILE)) {
      return fs.readFileSync(REFRESH_TOKEN_FILE, 'utf8').trim();
    }
  } catch (e) {}
  return null;
}

// ============ COMPLETE AUTHENTICATION FLOW (8 STEPS) ============

async function authenticateFullFlow(email, password, language = 'es') {
  console.log('🔐 ========================================');
  console.log('🔐 Starting complete OIDC flow...');
  console.log('🔐 ========================================\n');

  try {
    // Step 1: Start authentication process
    console.log('📍 Step 1: Starting authorization process...');
    const authResponse = await axios.get(
      `https://fidm.eu1.gigya.com/oidc/op/v1.0/${API_KEY}/authorize`,
      {
        headers: { 'User-Agent': BROWSER_USER_AGENT },
        params: {
          client_id: CLIENT_ID,
          response_type: 'code',
          redirect_uri: 'https://google.it',
          scope: 'openid email profile UID comfort en alexa',
          nonce: Date.now().toString()
        },
        maxRedirects: 0,
        validateStatus: status => status < 400 || status === 302
      }
    );
    
    const locationHeader = authResponse.headers.location || authResponse.headers['Location'];
    const context = getQueryParam(locationHeader, 'context');
    console.log('✅ Context obtained:', context ? context.substring(0, 20) + '...' : 'NULL');

    // Step 2: Fetch Gigya session data (gmid, ucid)
    console.log('\n📍 Step 2: Getting Gigya session IDs...');
    const idsResponse = await axios.get(
      'https://socialize.eu1.gigya.com/socialize.getIDs',
      {
        headers: { 'User-Agent': BROWSER_USER_AGENT },
        params: {
          APIKey: API_KEY,
          includeTicket: true,
          pageURL: 'https://aylaopenid.delonghigroup.com/',
          sdk: 'js_latest',
          sdkBuild: SDK_BUILD,
          format: 'json'
        }
      }
    );
    
    const { ucid, gmid, gmidTicket } = idsResponse.data;
    console.log('✅ ucid:', ucid);
    console.log('✅ gmid:', gmid ? gmid.substring(0, 20) + '...' : 'NULL');

    // Step 3: Login
    console.log('\n📍 Step 3: Login with credentials...');
    const riskContext = JSON.stringify({
      b0: 4494,
      b1: [0, 2, 2, 0],
      b2: 2,
      b3: [],
      b4: 2,
      b5: 1,
      b6: BROWSER_USER_AGENT,
      b7: [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', length: 2 },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', length: 2 }
      ],
      b8: new Date().toTimeString().split(' ')[0],
      b9: 0,
      b10: { state: 'denied' },
      b11: false,
      b13: [5, '440|956|24', false, true]
    });

    const loginResponse = await axios.post(
      'https://accounts.eu1.gigya.com/accounts.login',
      new URLSearchParams({
        loginID: email,
        password: password,
        sessionExpiration: '7884009',
        targetEnv: 'jssdk',
        include: 'profile,data,emails,subscriptions,preferences',
        includeUserInfo: 'true',
        loginMode: 'standard',
        lang: language,
        riskContext: encodeURIComponent(riskContext),
        APIKey: API_KEY,
        source: 'showScreenSet',
        sdk: 'js_latest',
        authMode: 'cookie',
        pageURL: 'https://aylaopenid.delonghigroup.com/',
        gmid: gmid,
        ucid: ucid,
        sdkBuild: SDK_BUILD.toString(),
        format: 'json'
      }).toString(),
      {
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (loginResponse.data.errorCode !== 0) {
      throw new Error(loginResponse.data.errorMessage || 'Login error');
    }

    const loginToken = loginResponse.data.sessionInfo?.login_token;
    console.log('✅ Login successful, login_token:', loginToken ? loginToken.substring(0, 20) + '...' : 'NULL');

    // Step 4: Get user info
    console.log('\n📍 Step 4: Getting user info...');
    const userInfoResponse = await axios.post(
      'https://socialize.eu1.gigya.com/socialize.getUserInfo',
      new URLSearchParams({
        enabledProviders: '*',
        APIKey: API_KEY,
        sdk: 'js_latest',
        login_token: loginToken,
        authMode: 'cookie',
        pageURL: 'https://aylaopenid.delonghigroup.com/',
        gmid: gmid,
        ucid: ucid,
        sdkBuild: SDK_BUILD.toString(),
        format: 'json'
      }).toString(),
      {
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const userUid = userInfoResponse.data.UID;
    const userUidSignature = userInfoResponse.data.UIDSignature;
    const userSignatureTimestamp = userInfoResponse.data.signatureTimestamp;
    console.log('✅ UID:', userUid);

    // Step 5: Consent page (to get signature)
    console.log('\n📍 Step 5: Getting consent signature...');
    const consentResponse = await axios.get(
      'https://aylaopenid.delonghigroup.com/OIDCConsentPage.php',
      {
        headers: { 'User-Agent': BROWSER_USER_AGENT },
        params: {
          lang: language,
          context: context,
          clientID: CLIENT_ID,
          scope: 'openid+email+profile+UID+comfort+en+alexa',
          UID: userUid,
          UIDSignature: userUidSignature,
          signatureTimestamp: userSignatureTimestamp
        }
      }
    );

    // Extraer signature del HTML
    const signatureMatch = consentResponse.data.match(/const consentObj2Sig = '([^']+)'/);
    if (!signatureMatch) {
      throw new Error('Could not extract consent signature');
    }
    const signature = signatureMatch[1];
    console.log('✅ Signature obtained:', signature.substring(0, 20) + '...');

    // Step 6: Authorization continue
    console.log('\n📍 Step 6: Continuing authorization...');
    const consentObj = {
      scope: 'openid email profile UID comfort en alexa',
      clientID: CLIENT_ID,
      context: context,
      UID: userUid,
      consent: true
    };

    const authContinueResponse = await axios.get(
      `https://fidm.eu1.gigya.com/oidc/op/v1.0/${API_KEY}/authorize/continue`,
      {
        headers: { 'User-Agent': BROWSER_USER_AGENT },
        params: {
          context: context,
          login_token: loginToken,
          consent: JSON.stringify(consentObj),
          sig: signature,
          gmidTicket: gmidTicket
        },
        maxRedirects: 0,
        validateStatus: status => status < 400 || status === 302
      }
    );

    const codeLocation = authContinueResponse.headers.location || authContinueResponse.headers['Location'];
    const code = getQueryParam(codeLocation, 'code');
    console.log('✅ Authorization code:', code ? code.substring(0, 20) + '...' : 'NULL');

    // Step 7: Get IDP access token
    console.log('\n📍 Step 7: Getting IDP access token...');
    const tokenResponse = await axios.post(
      `https://fidm.eu1.gigya.com/oidc/op/v1.0/${API_KEY}/token`,
      new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: 'https://google.it'
      }).toString(),
      {
        headers: {
          'User-Agent': TOKEN_USER_AGENT,
          'Authorization': AUTHORIZATION_HEADER,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const idpToken = tokenResponse.data.access_token;
    console.log('✅ IDP token obtained:', idpToken ? idpToken.substring(0, 20) + '...' : 'NULL');

    // Step 8: Exchange IDP token for Ayla token
    console.log('\n📍 Step 8: Exchanging for Ayla token...');
    console.log('   Token a enviar:', idpToken);
    console.log('   URL:', `${AYLA_USER_URL}api/v1/token_sign_in`);
    
    try {
      // Intentar primero con form-urlencoded (como en Python)
      const aylaResponse = await axios.post(
        `${AYLA_USER_URL}api/v1/token_sign_in`,
        new URLSearchParams({
          app_id: APP_ID,
          app_secret: APP_SECRET,
          token: idpToken
        }).toString(),
        {
          headers: {
            'User-Agent': TOKEN_USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      console.log('✅ Ayla token obtained successfully!');
      console.log('   Respuesta:', JSON.stringify(aylaResponse.data, null, 2));
      
      // Guardar refresh token
      saveRefreshToken(aylaResponse.data.refresh_token);

      return {
        accessToken: aylaResponse.data.access_token,
        refreshToken: aylaResponse.data.refresh_token,
        expiresIn: aylaResponse.data.expires_in || 86400
      };
    } catch (err1) {
      console.log('⚠️ form-urlencoded failed:', err1.response?.status, err1.response?.data);
      
      // Intentar con JSON
      console.log('   Intentando con JSON...');
      try {
        const aylaResponse2 = await axios.post(
          `${AYLA_USER_URL}api/v1/token_sign_in`,
          {
            app_id: APP_ID,
            app_secret: APP_SECRET,
            token: idpToken
          },
          {
            headers: {
              'User-Agent': TOKEN_USER_AGENT,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        );

        console.log('✅ Ayla token obtained with JSON!');
        saveRefreshToken(aylaResponse2.data.refresh_token);

        return {
          accessToken: aylaResponse2.data.access_token,
          refreshToken: aylaResponse2.data.refresh_token,
          expiresIn: aylaResponse2.data.expires_in || 86400
        };
      } catch (err2) {
        console.log('⚠️ JSON also failed:', err2.response?.status, err2.response?.data);
        
        // Intentar con provider especificado
        console.log('   Intentando con provider delonghigroup_eu...');
        const aylaResponse3 = await axios.post(
          `${AYLA_USER_URL}api/v1/token_sign_in`,
          {
            app_id: APP_ID,
            app_secret: APP_SECRET,
            token: idpToken,
            provider: 'delonghigroup_eu'
          },
          {
            headers: {
              'User-Agent': TOKEN_USER_AGENT,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        );

        console.log('✅ Ayla token obtained with provider!');
        saveRefreshToken(aylaResponse3.data.refresh_token);

        return {
          accessToken: aylaResponse3.data.access_token,
          refreshToken: aylaResponse3.data.refresh_token,
          expiresIn: aylaResponse3.data.expires_in || 86400
        };
      }
    }

    return {
      accessToken: aylaResponse.data.access_token,
      refreshToken: aylaResponse.data.refresh_token,
      expiresIn: aylaResponse.data.expires_in || 86400
    };

  } catch (error) {
    console.error('❌ Authentication error:', error.response?.data || error.message);
    throw error;
  }
}

// Refresh existing token
async function refreshAccessToken(refreshToken) {
  console.log('🔄 Refreshing access token...');
  
  try {
    const response = await axios.post(
      `${AYLA_USER_URL}users/refresh_token.json`,
      {
        user: { refresh_token: refreshToken }
      },
      {
        headers: {
          'User-Agent': TOKEN_USER_AGENT,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.refresh_token) {
      saveRefreshToken(response.data.refresh_token);
    }

    console.log('✅ Token refreshed successfully');
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresIn: response.data.expires_in || 86400
    };
  } catch (error) {
    console.log('⚠️ Error refreshing token:', error.message);
    throw error;
  }
}

// Main authentication
async function authenticate(email, password) {
  // First try with saved refresh token
  const savedRefreshToken = loadRefreshToken();
  if (savedRefreshToken) {
    try {
      console.log('🔑 Trying with saved refresh token...');
      const tokens = await refreshAccessToken(savedRefreshToken);
      authState.aylaToken = tokens.accessToken;
      authState.refreshToken = tokens.refreshToken;
      authState.expiresAt = Date.now() + (tokens.expiresIn * 1000);
      return true;
    } catch (e) {
      console.log('⚠️ Invalid refresh token, doing full login...\n');
    }
  }

  // If no refresh token or failed, do full login
  const tokens = await authenticateFullFlow(email, password);
  authState.aylaToken = tokens.accessToken;
  authState.refreshToken = tokens.refreshToken;
  authState.expiresAt = Date.now() + (tokens.expiresIn * 1000);
  return true;
}

// Get devices
async function getDevices() {
  const response = await axios.get(
    `${AYLA_BASE_URL}apiv1/devices.json`,
    { headers: getAylaHeaders() }
  );
  
  authState.devices = response.data.map(d => ({
    dsn: d.device.dsn,
    productName: d.device.product_name,
    model: d.device.model,
    connectionStatus: d.device.connection_status,
    lanEnabled: d.device.lan_enabled
  }));
  
  return authState.devices;
}

// Get device properties
async function getDeviceProperties(dsn) {
  const response = await axios.get(
    `${AYLA_BASE_URL}apiv1/dsns/${dsn}/properties.json`,
    { headers: getAylaHeaders() }
  );
  
  const props = {};
  response.data.forEach(p => {
    props[p.property.name] = p.property.value;
  });
  
  return props;
}

// Set device property
async function setDeviceProperty(dsn, propertyName, value) {
  const response = await axios.post(
    `${AYLA_BASE_URL}apiv1/dsns/${dsn}/properties/${propertyName}/datapoints.json`,
    { datapoint: { value } },
    { headers: getAylaHeaders() }
  );
  
  return response.data;
}

// ============ ENDPOINTS DE LA API ============

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const finalEmail = email || process.env.DELONGHI_EMAIL;
    const finalPassword = password || process.env.DELONGHI_PASSWORD;
    
    if (!finalEmail || !finalPassword) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    await authenticate(finalEmail, finalPassword);
    res.json({ success: true, message: 'Authentication successful' });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: error.message || 'Authentication error' });
  }
});

// Get authentication status
app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: !!authState.aylaToken,
    expiresAt: authState.expiresAt
  });
});

// Get devices
app.get('/api/devices', async (req, res) => {
  try {
    if (!authState.aylaToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const devices = await getDevices();
    res.json(devices);
  } catch (error) {
    console.error('Error getting devices:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get device status
app.get('/api/devices/:dsn/status', async (req, res) => {
  try {
    if (!authState.aylaToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const properties = await getDeviceProperties(req.params.dsn);
    res.json({
      isOn: properties.set_status === 1,
      humidity: properties.humidity_value,
      targetHumidity: properties.humidity_setpoint,
      temperature: properties.temperature_value,
      mode: properties.device_mode,
      fanSpeed: properties.fan_speed,
      tankFull: properties.tank_full === 1,
      filterStatus: properties.filter_clean
    });
  } catch (error) {
    console.error('Error getting status:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Turn on device
app.post('/api/devices/:dsn/on', async (req, res) => {
  try {
    if (!authState.aylaToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    await setDeviceProperty(req.params.dsn, 'set_status', 1);
    res.json({ success: true, message: 'Device turned on' });
  } catch (error) {
    console.error('Error turning on:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Turn off device
app.post('/api/devices/:dsn/off', async (req, res) => {
  try {
    if (!authState.aylaToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    await setDeviceProperty(req.params.dsn, 'set_status', 2);
    res.json({ success: true, message: 'Device turned off' });
  } catch (error) {
    console.error('Error turning off:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Change mode
app.post('/api/devices/:dsn/mode', async (req, res) => {
  try {
    if (!authState.aylaToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { mode } = req.body;
    await setDeviceProperty(req.params.dsn, 'device_mode', mode);
    res.json({ success: true, message: `Mode changed to ${mode}` });
  } catch (error) {
    console.error('Error changing mode:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Set target humidity
app.post('/api/devices/:dsn/humidity', async (req, res) => {
  try {
    if (!authState.aylaToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { humidity } = req.body;
    await setDeviceProperty(req.params.dsn, 'humidity_setpoint', humidity);
    res.json({ success: true, message: `Target humidity: ${humidity}%` });
  } catch (error) {
    console.error('Error setting humidity:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📱 De'Longhi DDSX220WFA Control API`);
  console.log(`📝 Flujo OIDC completo implementado\n`);
});
