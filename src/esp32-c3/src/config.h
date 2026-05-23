#pragma once

// ── WiFi ──────────────────────────────────────────────────────────────────────
#define WIFI_SSID "Riv-Internet-F"
#define WIFI_PASS "juve3074"

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
#define STATUS_MS 100  // send motor values to app every N ms

// ── Debug ─────────────────────────────────────────────────────────────────────
#define DEBUG
#ifdef DEBUG
  #define LOG(...) Serial.printf(__VA_ARGS__)
#else
  #define LOG(...)
#endif
