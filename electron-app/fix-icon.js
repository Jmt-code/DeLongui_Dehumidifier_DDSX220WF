const fs = require('fs');
const path = require('path');

// Create a 256x256 PNG with a gradient and thermometer emoji
// This is a minimal valid PNG

// For Windows, we need an ICO file or a large PNG
// Let's update package.json to not require an icon

const packagePath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Quitar la referencia al icono que causa problemas
delete pkg.build.win.icon;
pkg.build.win.target = [
  {
    target: 'portable',
    arch: ['x64']
  }
];

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
console.log('Package.json actualizado - icono removido');
