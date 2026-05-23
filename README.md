# Dron — ESP32-C3 Quadcopter

Cuadricóptero completo con firmware Arduino en ESP32-C3, controlador web en React/Tailwind, app móvil React Native, y visión computacional con YOLO/MediaPipe.

---

## Demo

<!-- TODO: reemplazar con GIF de vuelo real -->
> 📸 *Agregá acá un GIF de vuelo — podés arrastrarlo directo desde el explorador al editor de GitHub*

---

## Diagrama de circuito

<!-- TODO: reemplazar con foto del diagrama del dron -->
> 📐 *Agregá acá la foto del diagrama de conexiones — arrastrala al editor de GitHub o usá el botón "Attach files"*

---

## Arquitectura

```
App móvil / Web Controller
        │  WebSocket (ws://drone.local:81)
        ▼
ESP32-C3  ─── I2C ──▶  MPU-9250/6500 (gyro + accel)
    │
    ├── DRV8833 Motor Driver
    │       ├── Motor FL  GPIO4  (CW)
    │       ├── Motor FR  GPIO3  (CCW)
    │       ├── Motor BL  GPIO2  (CCW)
    │       └── Motor BR  GPIO5  (CW)
    └── STBY  GPIO10

ESP32-CAM ─── HTTP ──▶  Scripts Python (YOLO / MediaPipe)
```

---

## Hardware

| Componente            | Detalle                              |
|-----------------------|--------------------------------------|
| Microcontrolador      | ESP32-C3 (vuelo + WiFi + WebSocket)  |
| Módulo cámara         | ESP32-CAM (servidor HTTP de frames)  |
| IMU                   | MPU-9250 / MPU-6500 (I2C)            |
| Sensor de presión     | BMP280                               |
| Driver motores        | DRV8833                              |
| Motores               | 4× cepillo DC 50k RPM                |

### Pinout ESP32-C3

| GPIO | Función       |
|------|---------------|
| 2    | Motor BL (PWM)|
| 3    | Motor FR (PWM)|
| 4    | Motor FL (PWM)|
| 5    | Motor BR (PWM)|
| 8    | IMU SDA       |
| 9    | IMU SCL       |
| 10   | DRV8833 STBY  |

---

## Estructura del proyecto

```
src/
├── esp32-c3/src/
│   ├── main.cpp      # Firmware: mezcla de motores, WebSocket, PID, watchdog
│   └── config.h      # Pines, WiFi, mDNS, parámetros PID y estabilización
├── web-controller/   # Controlador web React + TypeScript + Tailwind
│   └── src/
│       ├── App.tsx
│       ├── hooks/useDrone.ts
│       └── components/
├── app-controller/   # App móvil React Native / Expo (iOS + Android)
├── controller/       # Legacy: Bluepad32 Bluetooth gamepad
└── detection/
    ├── camHttpServer.ino          # ESP32-CAM servidor HTTP
    ├── generalDetectionYolo8.py  # YOLOv8 Nano
    ├── handDetection.py          # MediaPipe manos
    └── generalDetection.py       # YOLOv4
```

---

## Setup y build

### 1. Credenciales WiFi

```bash
# En la raíz del proyecto:
cp .env.example .env
# Editá .env con tu SSID y contraseña
```

El archivo `.env` está en `.gitignore` — nunca se commitea.

### 2. ESP32-C3 Firmware

```bash
# Compilar
pio run -e esp32-c3

# Subir al ESP32
pio upload -e esp32-c3

# Monitor serie (115200 baud)
pio device monitor -b 115200
```

### 3. Web Controller

```bash
cd src/web-controller
npm install   # primera vez
npm run dev   # dev server → http://localhost:5173
npm run build # build de producción → dist/
```

### 4. App Móvil (React Native / Expo)

```bash
cd src/app-controller
npm install
npm start        # Expo QR code
npm run android  # Android
npm run ios      # iOS
```

### 5. Visión computacional (Python)

```bash
cd src/detection
python generalDetectionYolo8.py   # YOLOv8
python handDetection.py           # MediaPipe manos
```

La ESP32-CAM debe estar en red en `http://192.168.1.74` (hardcodeado en los scripts).

---

## Protocolo WebSocket

El ESP32-C3 escucha en `ws://drone.local:81`.

### Comandos (app → ESP32)

```json
{ "cmd": "arm" }
{ "cmd": "disarm" }
{ "cmd": "stby", "val": true }
{ "cmd": "move", "t": 0, "y": 0, "p": 0, "r": 0 }
{ "cmd": "raw",  "fl": 0, "fr": 0, "bl": 0, "br": 0 }
```

| Campo | Rango      | Descripción                   |
|-------|------------|-------------------------------|
| `t`   | 0–255      | Throttle                      |
| `y`   | −127..127  | Yaw (tasa de rotación)        |
| `p`   | −127..127  | Pitch (ángulo objetivo)       |
| `r`   | −127..127  | Roll (ángulo objetivo)        |

### Telemetría (ESP32 → app) cada 100 ms

```json
{
  "motors": [120, 118, 115, 122],
  "armed": true,
  "stby": true,
  "roll": -1.4,
  "pitch": 0.8,
  "imu": true
}
```

---

## Mezcla de motores (X-config)

```
FL (CW)  ●─────● FR (CCW)
         │     │
         │     │
BL (CCW) ●─────● BR (CW)
```

| Motor | Fórmula                   |
|-------|---------------------------|
| FL    | t − roll + pitch + yaw    |
| FR    | t + roll + pitch − yaw    |
| BL    | t − roll − pitch − yaw    |
| BR    | t + roll − pitch + yaw    |

---

## Estabilización PID

El firmware usa un **filtro complementario** (α=0.98) sobre gyro + acelerómetro para estimar roll y pitch. Tres controladores PID:

- **Roll / Pitch** → control de ángulo (setpoint = joystick × MAX_ANGLE 30°)
- **Yaw** → control de tasa de rotación (setpoint = joystick × MAX_YAW_RATE 90°/s)

### Tuning (parámetros en `config.h`)

Empezá con valores bajos y subí gradualmente:

```c
#define PID_ROLL_KP  1.8f   // Proporcional — cuánto corrige por grado de error
#define PID_ROLL_KI  0.02f  // Integral     — corrige deriva lenta
#define PID_ROLL_KD  0.08f  // Derivativo   — amortigua oscilaciones
```

Si el dron **oscila** → bajá `Kp` o subí `Kd`.  
Si **reacciona lento** → subí `Kp`.  
Si los ejes están **invertidos** → negá el signo del gyro correspondiente en `imuRead()`.

---

## Controles web (teclado)

| Tecla       | Acción              |
|-------------|---------------------|
| W / S       | Throttle ↑↓         |
| A / D       | Yaw ←→              |
| ↑ / ↓       | Pitch adelante/atrás|
| ← / →       | Roll ladear         |
| Espacio     | ARM / DISARM        |

---

## Seguridad

- **Watchdog**: el ESP32 desarma automáticamente si no recibe comandos en 500 ms.
- **STBY pin**: los drivers DRV8833 quedan en standby hasta que se activan explícitamente.
- El comando `raw` ignora el PID — usarlo solo para testing con el dron en el suelo.
