const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// De'Longhi/Ayla Networks API Constants
const API_KEY = '3_e5qn7USZK-QtsIso1wCelqUKAK_IVEsYshRIssQ-X-k55haiZXmKWDHDRul2e5Y2';
const CLIENT_ID = '1S8q1WJEs-emOB43Z0-66WnL';
const CLIENT_SECRET = 'lmnceiD0B-4KPNN5ZS6WuWU70j9V5BCuSlz2OPsvHkyLryhMkJkPvKsivfTq3RfNYj8GpCELtOBvhaDIzKcBtg';
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

// Step 1: Start authorization with Gigya
async function startAuthorization() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: 'aylaapp://com.delonghi.ays.comfort/oidc_login',
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge_method: 'S256',
    code_challenge: 'challenge'
  });

  const response = await axios.get(
    `https://fidm.eu1.gigya.com/oidc/op/v1.0/${API_KEY}/authorize?${params}`,
    { maxRedirects: 0, validateStatus: (status) => status < 400 || status === 302 }
  );

  // Extraer context del header Location o cookies
  const cookies = response.headers['set-cookie'];
  let context = '';
  if (cookies) {
    const contextCookie = cookies.find(c => c.includes('context'));
    if (contextCookie) {
      context = contextCookie.split('context=')[1]?.split(';')[0] || '';
    }
  }
  return context;
}

// Step 2: Login with credentials
async function loginGigya(email, password) {
  console.log('📧 Attempting login with:', email);
  
  const params = new URLSearchParams({
    apiKey: API_KEY,
    loginID: email,
    password: password,
    sessionExpiration: '-2',
    targetEnv: 'mobile',
    include: 'profile,data',
    loginMode: 'standard'
  });

  console.log('🌐 Llamando a accounts.eu1.gigya.com/accounts.login...');
  
  try {
    const response = await axios.post(
      'https://accounts.eu1.gigya.com/accounts.login',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log('📥 Gigya login response:', JSON.stringify(response.data, null, 2));

    if (response.data.errorCode !== 0) {
      console.error('❌ Gigya error:', response.data.errorCode, response.data.errorMessage);
      throw new Error(response.data.errorMessage || `Login error: code ${response.data.errorCode}`);
    }

    console.log('✅ Gigya login successful, UID:', response.data.UID);
    console.log('📝 Session Token:', response.data.sessionInfo?.sessionToken ? 'present' : 'NOT PRESENT');

    return {
      loginToken: response.data.sessionInfo?.sessionToken,
      uid: response.data.UID,
      uidSignature: response.data.UIDSignature,
      signatureTimestamp: response.data.signatureTimestamp
    };
  } catch (error) {
    console.error('❌ Error en loginGigya:', error.response?.data || error.message);
    throw error;
  }
}

// Step 3: Get JWT Token
async function getJWTToken(loginToken) {
  console.log('🎫 Getting JWT Token...');
  console.log('📝 Login Token received:', loginToken ? `${loginToken.substring(0, 20)}...` : 'NULL');
  
  const params = new URLSearchParams({
    apiKey: API_KEY,
    login_token: loginToken,
    fields: 'profile.firstName,profile.lastName,profile.email',
    expiration: 3600
  });

  try {
    const response = await axios.post(
      'https://accounts.eu1.gigya.com/accounts.getJWT',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log('📥 getJWT response:', JSON.stringify(response.data, null, 2));

    if (response.data.errorCode !== 0) {
      console.error('❌ getJWT error:', response.data.errorCode, response.data.errorMessage);
      throw new Error(response.data.errorMessage || `Error getting JWT: code ${response.data.errorCode}`);
    }

    console.log('✅ JWT obtained:', response.data.id_token ? `${response.data.id_token.substring(0, 30)}...` : 'NULL');
    return response.data.id_token;
  } catch (error) {
    console.error('❌ Error en getJWTToken:', error.response?.data || error.message);
    throw error;
  }
}

// Step 4: Exchange JWT for Ayla token
async function getAylaToken(jwtToken) {
  console.log('🔑 Exchanging JWT for Ayla token...');
  console.log('📝 JWT Token:', jwtToken ? `${jwtToken.substring(0, 30)}...` : 'NULL');
  console.log('🌐 URL:', `${AYLA_USER_URL}api/v1/token_sign_in`);
  
  const payload = {
    token: jwtToken,
    app_id: APP_ID,
    app_secret: APP_SECRET,
    provider: 'delonghigroup_eu'
  };
  
  console.log('📤 Payload (sin token):', { ...payload, token: '...' });
  
  try {
    const response = await axios.post(
      `${AYLA_USER_URL}api/v1/token_sign_in`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log('📥 Ayla response:', JSON.stringify(response.data, null, 2));
    console.log('✅ Ayla token obtained successfully');

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    console.error('❌ Error en getAylaToken:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
}

// Complete authentication function
async function authenticate(email, password) {
  console.log('🔐 Starting authentication...');
  
  // Direct login with Gigya
  const loginData = await loginGigya(email, password);
  console.log('✅ Login successful');
  
  // Get JWT
  const jwtToken = await getJWTToken(loginData.loginToken);
  console.log('✅ JWT obtained');
  
  // Get Ayla token
  const aylaData = await getAylaToken(jwtToken);
  console.log('✅ Ayla token obtained');
  
  authState.aylaToken = aylaData.accessToken;
  authState.refreshToken = aylaData.refreshToken;
  authState.expiresAt = Date.now() + (aylaData.expiresIn * 1000);
  
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
      mode: properties.device_mode, // 1: Dehumidify, 2: Dry clothes, 3: Purifier
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
    
    const { mode } = req.body; // 1: Dehumidify, 2: Dry clothes, 3: Purifier
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
