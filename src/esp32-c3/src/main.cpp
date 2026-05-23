#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include "config.h"

// ── Globals ───────────────────────────────────────────────────────────────────

static WebSocketsServer ws(WS_PORT);

static bool armed = false;
static bool stbyEnabled = false;
static uint32_t lastStatusMs = 0;
static uint8_t motorVals[4] = {0, 0, 0, 0};  // FL, FR, BL, BR

static constexpr uint8_t motorPins[4] = {PIN_MOTOR_FL, PIN_MOTOR_FR, PIN_MOTOR_BL, PIN_MOTOR_BR};

// ── Motor control ─────────────────────────────────────────────────────────────

static void writeMotors(uint8_t fl, uint8_t fr, uint8_t bl, uint8_t br) {
  motorVals[0] = fl;
  motorVals[1] = fr;
  motorVals[2] = bl;
  motorVals[3] = br;
  analogWrite(PIN_MOTOR_FL, fl);
  analogWrite(PIN_MOTOR_FR, fr);
  analogWrite(PIN_MOTOR_BL, bl);
  analogWrite(PIN_MOTOR_BR, br);
}

static void stopMotors() {
  writeMotors(0, 0, 0, 0);
}

// Quadcopter X-config mixing
// t: throttle 0-255 | y: yaw -127..127 | p: pitch -127..127 | r: roll -127..127
static void applyMovement(uint8_t t, int8_t y, int8_t p, int8_t r) {
  auto clamp = [](int v) -> uint8_t { return (uint8_t)constrain(v, 0, PWM_MAX); };
  writeMotors(clamp(t - r + p + y),  // FL (CW)
              clamp(t + r + p - y),  // FR (CCW)
              clamp(t - r - p - y),  // BL (CCW)
              clamp(t + r - p + y)  // BR (CW)
  );
}

// ── WebSocket handler ─────────────────────────────────────────────────────────

static void onWsEvent(uint8_t id, WStype_t type, uint8_t *payload, size_t len) {
  switch (type) {

  case WStype_CONNECTED:
    LOG("[WS] Client %d connected from %s\n", id, ws.remoteIP(id).toString().c_str());
    break;

  case WStype_DISCONNECTED:
    LOG("[WS] Client %d disconnected\n", id);
    stopMotors();
    armed = false;
    break;

  case WStype_TEXT: {
    JsonDocument doc;
    if (deserializeJson(doc, payload, len))
      break;

    const char *cmd = doc["cmd"] | "";

    if (strcmp(cmd, "arm") == 0) {
      armed = true;
      LOG("[WS] Armed\n");

    } else if (strcmp(cmd, "disarm") == 0) {
      armed = false;
      stopMotors();
      LOG("[WS] Disarmed\n");

    } else if (strcmp(cmd, "stby") == 0) {
      bool val = doc["val"] | false;
      stbyEnabled = val;
      digitalWrite(PIN_STBY, val ? HIGH : LOW);
      if (!val) {
        stopMotors();
        armed = false;
      }
      LOG("[WS] STBY %s\n", val ? "ON" : "OFF");

    } else if (strcmp(cmd, "move") == 0 && armed) {
      uint8_t t = doc["t"] | 0;
      int8_t yaw = doc["y"] | 0;
      int8_t pitch = doc["p"] | 0;
      int8_t roll = doc["r"] | 0;
      applyMovement(t, yaw, pitch, roll);

    } else if (strcmp(cmd, "raw") == 0 && armed) {
      uint8_t fl = doc["fl"] | 0;
      uint8_t fr = doc["fr"] | 0;
      uint8_t bl = doc["bl"] | 0;
      uint8_t br = doc["br"] | 0;
      writeMotors(fl, fr, bl, br);
    }
    break;
  }

  default:
    break;
  }
}

// ── Setup / Loop ──────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);

  pinMode(PIN_STBY, OUTPUT);
  digitalWrite(PIN_STBY, LOW);  // drivers en standby al arrancar
  LOG("STBY pin %d initialized (LOW)\n", PIN_STBY);

  analogWriteResolution(PWM_BITS);
  analogWriteFrequency(PWM_FREQ);
  for (uint8_t pin : motorPins) {
    pinMode(pin, OUTPUT);
    analogWrite(pin, 0);
  }
  LOG("Motors initialized on pins %d %d %d %d\n", PIN_MOTOR_FL, PIN_MOTOR_FR, PIN_MOTOR_BL, PIN_MOTOR_BR);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  LOG("Connecting to %s", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    LOG(".");
  }
  LOG("\nIP: %s\n", WiFi.localIP().toString().c_str());

  MDNS.begin(MDNS_NAME);
  MDNS.addService("ws", "tcp", WS_PORT);
  LOG("mDNS: ws://%s.local:%d\n", MDNS_NAME, WS_PORT);

  ws.begin();
  ws.onEvent(onWsEvent);
  LOG("WebSocket server on port %d\n", WS_PORT);
}

void loop() {
  ws.loop();

  // Broadcast motor status to all connected clients
  if (millis() - lastStatusMs >= STATUS_MS) {
    lastStatusMs = millis();
    char buf[72];
    snprintf(buf, sizeof(buf), "{\"motors\":[%d,%d,%d,%d],\"armed\":%s,\"stby\":%s}", motorVals[0], motorVals[1],
             motorVals[2], motorVals[3], armed ? "true" : "false", stbyEnabled ? "true" : "false");
    ws.broadcastTXT(buf);
  }
}
