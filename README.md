# 🌡️ De'Longhi Dehumidifier Control

Desktop application to control your **De'Longhi Tasciugo AriaDry** dehumidifier via WiFi.

## ✨ Features

- ⏻ Turn the dehumidifier on and off
- 💧 View current humidity and temperature
- 🎯 Adjust target humidity (30% - 80%)
- 👕 Change mode: Dehumidify, Dry Clothes, Purifier
- 🪣 Tank full alerts
- 💾 Remember credentials

## 📋 Requirements

1. De'Longhi dehumidifier with WiFi (tested with DDSX220WFA)
2. Account in the official **De'Longhi Comfort** app with the device configured
3. Windows 10/11

## 🚀 Usage

1. Go to the folder `electron-app/dist/win-unpacked/`
2. Run **`DeLonghi_Dehumidifier_Control.exe`**
3. Sign in with your De'Longhi Comfort credentials
4. Check "Remember me" to avoid signing in each time

> 💡 **Tip:** You can create a desktop shortcut by dragging the .exe while holding Alt.

## 🔧 Development

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ../electron-app && npm install

# Run in development mode
cd electron-app && npm start

# Build executable
cd frontend && npm run build
cd ../electron-app && npm run build:win
```

## 🔒 Security

Credentials are stored locally. See [SECURITY.md](SECURITY.md).

## 📄 License

MIT - Personal use.
