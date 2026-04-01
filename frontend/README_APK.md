# Cómo generar el APK de Tourstilla

## Requisitos previos
1. Node.js instalado (https://nodejs.org)
2. Cuenta gratuita en Expo (https://expo.dev)

## Pasos para generar el APK

### 1. Clonar el repositorio
```bash
git clone https://github.com/PeterDGS/tourstilla-app.git
cd tourstilla-app/frontend
```

### 2. Instalar dependencias
```bash
npm install -g eas-cli
npm install
```

### 3. Iniciar sesión en Expo
```bash
eas login
```

### 4. Generar el APK
```bash
eas build --platform android --profile preview
```

### 5. Descargar el APK
Una vez termine el build (5-15 minutos), recibirás un enlace para descargar el APK.

## Notas
- El APK generado se puede instalar directamente en cualquier Android
- Para iOS necesitas cuenta de Apple Developer ($99/año)

## Credenciales de la app
- **Admin:** admin@tours.com / admin123
- **Guía de prueba:** maria@test.com / maria123
