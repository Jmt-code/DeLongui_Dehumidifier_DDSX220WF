const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// De'Longhi/Ayla Networks API Constants
// De'Longhi Comfort mobile app API Key
const API_KEY_MOBILE = '3_e5qn7USZK-QtsIso1wCelqUKAK_IVEsYshRIssQ-X-k55haiZXmKWDHDRul2e5Y2';
// Web (ecommerce) API Key
const API_KEY_WEB = '4_fxHuOUTIh30Qwu5ghqjH4g';

const APP_ID = 'DeLonghiComfort2-mw-id';
const APP_SECRET = 'DeLonghiComfort2-Yg4miiqiNcf0Or-EhJwRh7ACfBY';

const AYLA_BASE_URL = 'https://ads-eu.aylanetworks.com/';
const AYLA_USER_URL = 'https://user-field-eu.aylanetworks.com/';

// Global state to store tokens
let authState = {
  aylaToken: null,
  refreshToken: null,
  devices: [],
  expiresAt: null
};

// Common headers for Ayla
const getAylaHeaders = () => ({
  'User-Agent': 'DeLonghiComfort/5.1.1 (iPhone; iOS 18.2; Scale/3.00)',
  'Authorization': `auth_token ${authState.aylaToken}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
});

// Generate code_verifier and code_challenge for PKCE
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// Step 1: Login with Gigya (tries both API keys)
async function loginGigya(email, password, apiKey) {
  console.log(`📧 Login with Gigya using API Key: ${apiKey.substring(0, 10)}...`);
  
  const params = new URLSearchParams({
    apiKey: apiKey,
    loginID: email,
    password: password,
    sessionExpiration: '15768000',
    targetEnv: 'jssdk',
    include: 'profile,data,emails,subscriptions,preferences,id_token',
    includeUserInfo: 'true',
    loginMode: 'standard',
    lang: 'es'
  });

  const response = await axios.post(
    'https://accounts.eu1.gigya.com/accounts.login',
    params.toString(),
    { 
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      } 
    }
  );

  console.log('📥 Respuesta login errorCode:', response.data.errorCode);
  
  if (response.data.errorCode !== 0) {
    throw new Error(response.data.errorMessage || 'Login error');
  }

  console.log('📥 Available fields:', Object.keys(response.data).join(', '));
  
  // Check if we have id_token directly
  if (response.data.id_token) {
    console.log('✅ id_token obtained directly from login!');
    return {
      idToken: response.data.id_token,
      sessionToken: response.data.sessionInfo?.sessionToken,
      uid: response.data.UID,
      apiKey: apiKey
    };
  }

  return {
    sessionToken: response.data.sessionInfo?.sessionToken,
    sessionSecret: response.data.sessionInfo?.sessionSecret,
    uid: response.data.UID,
    apiKey: apiKey,
    uidSignature: response.data.UIDSignature,
    signatureTimestamp: response.data.signatureTimestamp
  };
}

// Step 2: Use socialize.getToken to get id_token (legacy function, no longer used)
async function getIdToken(sessionToken, uid, apiKey) {
  console.log('🎫 Step 2: Getting id_token via socialize...');
  
  // First try with accounts.getAccountInfo to verify the session
  const verifyParams = new URLSearchParams({
    apiKey: apiKey || API_KEY_MOBILE,
    oauth_token: sessionToken,
    include: 'profile,data,identities-active',
    extraProfileFields: 'languages,phones,education,work'
  });

  try {
    const verifyResponse = await axios.post(
      'https://accounts.eu1.gigya.com/accounts.getAccountInfo',
      verifyParams.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    console.log('📥 getAccountInfo errorCode:', verifyResponse.data.errorCode);
    
    if (verifyResponse.data.errorCode === 0) {
      console.log('✅ Session verified');
    }
  } catch (e) {
    console.log('⚠️ Error verifying session:', e.message);
  }
  
  // Try to get the id_token using the notifyLogin flow
  const notifyParams = new URLSearchParams({
    apiKey: apiKey || API_KEY_MOBILE,
    siteUID: uid,
    sessionExpiration: 0,
    cid: `cid_${Date.now()}`
  });

  try {
    const notifyResponse = await axios.post(
      'https://socialize.eu1.gigya.com/socialize.notifyLogin',
      notifyParams.toString(),
      { 
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': `glt_${apiKey || API_KEY_MOBILE}=${sessionToken}`
        } 
      }
    );
    
    console.log('📥 notifyLogin response:', JSON.stringify(notifyResponse.data, null, 2));
    
    if (notifyResponse.data.id_token) {
      return notifyResponse.data.id_token;
    }
  } catch (e) {
    console.log('⚠️ notifyLogin error:', e.message);
  }

  return null;
}

// Step 3: Direct authentication with Ayla using email/password (alternative method)
async function loginAylaDirect(email, password) {
  console.log('🔑 Step 3: Trying direct login with Ayla...');
  
  try {
    const response = await axios.post(
      `${AYLA_USER_URL}users/sign_in.json`,
      {
        user: {
          email: email,
          password: password,
          application: {
            app_id: APP_ID,
            app_secret: APP_SECRET
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'DeLonghiComfort/5.1.1 (iPhone; iOS 18.2; Scale/3.00)'
        }
      }
    );

    console.log('📥 Ayla login response:', JSON.stringify(response.data, null, 2));
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in || 86400
    };
  } catch (error) {
    console.log('❌ Error Ayla direct login:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
}

// Alternative step: Use token_sign_in with Gigya id_token
async function getAylaTokenWithIdToken(idToken) {
  console.log('🔑 Exchanging id_token for Ayla token...');
  
  try {
    const response = await axios.post(
      `${AYLA_USER_URL}api/v1/token_sign_in`,
      {
        token: idToken,
        app_id: APP_ID,
        app_secret: APP_SECRET,
        provider: 'delonghigroup_eu'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log('📥 Ayla token_sign_in response:', JSON.stringify(response.data, null, 2));

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    console.log('❌ Error token_sign_in:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
}

// Complete authentication function - tries multiple methods
async function authenticate(email, password) {
  console.log('🔐 ========================================');
  console.log('🔐 Starting authentication for:', email);
  console.log('🔐 ========================================');
  
  // Method 1: Try direct login with Ayla (simplest)
  try {
    console.log('\n📍 Method 1: Direct login with Ayla...');
    const aylaData = await loginAylaDirect(email, password);
    
    authState.aylaToken = aylaData.accessToken;
    authState.refreshToken = aylaData.refreshToken;
    authState.expiresAt = Date.now() + (aylaData.expiresIn * 1000);
    
    console.log('✅ Authentication successful with method 1!');
    return true;
  } catch (e) {
    console.log('⚠️ Method 1 failed:', e.message);
  }

  // Method 2: Login with Gigya (mobile API Key) + id_token
  try {
    console.log('\n📍 Method 2: Login with Gigya (mobile API)...');
    const loginData = await loginGigya(email, password, API_KEY_MOBILE);
    
    let idToken = loginData.idToken;
    
    if (idToken) {
      console.log('✅ id_token obtained, exchanging for Ayla token...');
      const aylaData = await getAylaTokenWithIdToken(idToken);
      
      authState.aylaToken = aylaData.accessToken;
      authState.refreshToken = aylaData.refreshToken;
      authState.expiresAt = Date.now() + (aylaData.expiresIn * 1000);
      
      console.log('✅ Authentication successful with method 2!');
      return true;
    }
  } catch (e) {
    console.log('⚠️ Method 2 failed:', e.message);
  }

  // Method 3: Login with Gigya (web API Key) + id_token
  try {
    console.log('\n📍 Method 3: Login with Gigya (web API)...');
    const loginData = await loginGigya(email, password, API_KEY_WEB);
    
    let idToken = loginData.idToken;
    
    if (idToken) {
      console.log('✅ id_token obtained from web API, exchanging for Ayla token...');
      const aylaData = await getAylaTokenWithIdToken(idToken);
      
      authState.aylaToken = aylaData.accessToken;
      authState.refreshToken = aylaData.refreshToken;
      authState.expiresAt = Date.now() + (aylaData.expiresIn * 1000);
      
      console.log('✅ Authentication successful with method 3!');
      return true;
    }
  } catch (e) {
    console.log('⚠️ Method 3 failed:', e.message);
  }

  throw new Error('All authentication methods failed. Check your credentials.');
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
});
