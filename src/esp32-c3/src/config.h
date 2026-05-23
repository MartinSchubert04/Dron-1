#pragma once

// ── WiFi ──────────────────────────────────────────────────────────────────────
// Las credenciales vienen del archivo .env vía read_env.py (extra_scripts).
// Creá un .env en la raíz del proyecto con WIFI_SSID y WIFI_PASS.
#ifndef WIFI_SSID
  #define WIFI_SSID ""
#endif
#ifndef WIFI_PASS
  #define WIFI_PASS ""
#endif

// ── mDNS ─────────────────────────────────────────────────────────────────────
#define MDNS_NAME "drone"  // accesible como drone.local

// ── WebSocket server ──────────────────────────────────────────────────────────
#define WS_PORT 81

// ── DRV8833 STBY pin (HIGH = drivers active, LOW = standby/disabled) ─────────
// CAMBIA este numero al GPIO que vayas a usar
#define PIN_STBY 10

// ── Motor PWM pins (DRV8833 AIN1/BIN1 — AIN2/BIN2 tied to GND) ───────────────
#define PIN_MOTOR_FL 4  // Front-left
#define PIN_MOTOR_FR 3  // Front-right
#define PIN_MOTOR_BL 2  // Back-left
#define PIN_MOTOR_BR 5  // Back-right

// ── PWM ───────────────────────────────────────────────────────────────────────
#define PWM_FREQ 20000  // Hz
#define PWM_BITS 8  // resolution bits (0-255)
#define PWM_MAX 255

// ── Status broadcast ──────────────────────────────────────────────────────────
#define STATUS_MS    150  // telemetría cada N ms (menos overhead JSON)
#define WATCHDOG_MS  500  // si no llegan comandos en N ms, desarma por seguridad

// ── IMU (MPU-6500 / MPU-9250) I2C ────────────────────────────────────────────
#define IMU_SDA  8
#define IMU_SCL  9
#define IMU_ADDR 0x68  // AD0 = GND → 0x68; AD0 = 3V3 → 0x69

#define GYRO_SCALE  (250.0f / 32768.0f)  // °/s por LSB  (rango ±250 dps)
#define ACCEL_SCALE (2.0f   / 32768.0f)  // g   por LSB  (rango ±2 g)

// ── Estabilización ────────────────────────────────────────────────────────────
#define COMP_ALPHA    0.98f  // peso filtro complementario (gyro vs accel)
#define MAX_ANGLE     25.0f  // ángulo máximo desde joystick (°) — conservador
#define MAX_YAW_RATE  90.0f  // tasa de yaw máxima desde joystick (°/s)
#define PID_LIMIT     60.0f  // corrección PID máxima (cuentas PWM)
#define IMU_UPDATE_MS 5      // período loop estabilización = 200 Hz (libera CPU)

// Por debajo de este throttle, motores apagados y PID en reset (ahorra CPU al pairar armado)
#define THROTTLE_PID_MIN 15

// Si el dron corrige al revés en un eje, cambiá ese signo a -1
#define STAB_SIGN_ROLL   (+1)
#define STAB_SIGN_PITCH  (+1)
#define STAB_SIGN_YAW    (+1)

// ── PID — valores iniciales conservadores. Tunear con el dron en mano. ───────
// Subir KP de a poco hasta que el dron responda firme sin oscilar.
// Cuando empieza a oscilar, retroceder ~30% y agregar KD para amortiguar.

// PID Roll
#define PID_ROLL_KP  1.0f
#define PID_ROLL_KI  0.02f
#define PID_ROLL_KD  0.12f

// PID Pitch
#define PID_PITCH_KP 1.0f
#define PID_PITCH_KI 0.02f
#define PID_PITCH_KD 0.12f

// PID Yaw (control de tasa angular, no ángulo)
#define PID_YAW_KP   2.0f
#define PID_YAW_KI   0.0f
#define PID_YAW_KD   0.0f

// ── Debug ─────────────────────────────────────────────────────────────────────
#define DEBUG
#ifdef DEBUG
  #define LOG(...) Serial.printf(__VA_ARGS__)
#else
  #define LOG(...)
#endif
