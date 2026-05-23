#include <Arduino.h>
#include <Wire.h>
#include <Preferences.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include "config.h"

// ── Globals ───────────────────────────────────────────────────────────────────

static WebSocketsServer ws(WS_PORT);

static bool armed        = false;
static bool stbyEnabled  = false;
static bool rawMode      = false;  // true = cmd "raw" activo, PID en pausa
static uint32_t lastStatusMs = 0;
static uint8_t motorVals[4] = {0, 0, 0, 0};  // FL, FR, BL, BR

static constexpr uint8_t motorPins[4] = {PIN_MOTOR_FL, PIN_MOTOR_FR, PIN_MOTOR_BL, PIN_MOTOR_BR};

// ── PID ───────────────────────────────────────────────────────────────────────

struct PID {
  float Kp, Ki, Kd, limit;
  float integral  = 0.0f;
  float prevError = 0.0f;

  float compute(float setpoint, float measurement, float dt) {
    float error  = setpoint - measurement;
    integral     = constrain(integral + error * dt, -limit, limit);
    float deriv  = (dt > 0.0f) ? (error - prevError) / dt : 0.0f;
    prevError    = error;
    return constrain(Kp * error + Ki * integral + Kd * deriv, -limit, limit);
  }

  void reset() { integral = 0.0f; prevError = 0.0f; }
};

static PID pidRoll  {PID_ROLL_KP,  PID_ROLL_KI,  PID_ROLL_KD,  PID_LIMIT};
static PID pidPitch {PID_PITCH_KP, PID_PITCH_KI, PID_PITCH_KD, PID_LIMIT};
static PID pidYaw   {PID_YAW_KP,   PID_YAW_KI,   PID_YAW_KD,   PID_LIMIT};

// ── IMU – MPU-6500 / MPU-9250 vía I2C ────────────────────────────────────────

static float rollAngle  = 0.0f;
static float pitchAngle = 0.0f;
static float yawRate    = 0.0f;
static float gyroBias[3]  = {0.0f, 0.0f, 0.0f};
static float accelOff[3]  = {0.0f, 0.0f, 0.0f};  // offsets de calibración del acelerómetro
static bool  imuOk        = false;

// ── NVS calibración ───────────────────────────────────────────────────────────

static void loadCalibration() {
  Preferences prefs;
  prefs.begin("drone_cal", true);
  accelOff[0] = prefs.getFloat("ax", 0.0f);
  accelOff[1] = prefs.getFloat("ay", 0.0f);
  accelOff[2] = prefs.getFloat("az", 0.0f);
  prefs.end();
  LOG("[CAL] Offsets accel cargados: ax=%.4f ay=%.4f az=%.4f\n",
      accelOff[0], accelOff[1], accelOff[2]);
}

static void saveCalibration() {
  Preferences prefs;
  prefs.begin("drone_cal", false);
  prefs.putFloat("ax", accelOff[0]);
  prefs.putFloat("ay", accelOff[1]);
  prefs.putFloat("az", accelOff[2]);
  prefs.end();
  LOG("[CAL] Offsets guardados en NVS\n");
}

// ── Lectura IMU ───────────────────────────────────────────────────────────────

static void imuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(IMU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

static bool imuInit() {
  Wire.beginTransmission(IMU_ADDR);
  Wire.write(0x75);  // WHO_AM_I
  Wire.endTransmission(false);
  Wire.requestFrom(IMU_ADDR, (uint8_t)1);
  if (!Wire.available()) return false;
  uint8_t who = Wire.read();
  // MPU-6500 = 0x70, MPU-9250 = 0x71
  if (who != 0x70 && who != 0x71) {
    LOG("[IMU] WHO_AM_I=0x%02X (esperado 0x70 o 0x71)\n", who);
    return false;
  }
  LOG("[IMU] WHO_AM_I=0x%02X OK\n", who);
  imuWrite(0x6B, 0x80);  // reset completo
  delay(100);
  imuWrite(0x6B, 0x01);  // wake up, clock desde gyro X
  delay(10);
  imuWrite(0x1A, 0x03);  // DLPF ≈ 41 Hz
  imuWrite(0x19, 0x03);  // SMPLRT_DIV=3 → 250 Hz
  imuWrite(0x1B, 0x00);  // GYRO_CONFIG:  ±250 °/s
  imuWrite(0x1C, 0x00);  // ACCEL_CONFIG: ±2 g
  return true;
}

// Lee hardware sin ningún offset aplicado (usado solo en calibración)
static void imuReadRaw(float &ax, float &ay, float &az,
                       float &gx, float &gy, float &gz) {
  Wire.beginTransmission(IMU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(IMU_ADDR, (uint8_t)14);

  auto rd = []() -> int16_t {
    return (int16_t)((Wire.read() << 8) | Wire.read());
  };

  ax = rd() * ACCEL_SCALE;
  ay = rd() * ACCEL_SCALE;
  az = rd() * ACCEL_SCALE;
  rd();  // temperatura
  gx = rd() * GYRO_SCALE;
  gy = rd() * GYRO_SCALE;
  gz = rd() * GYRO_SCALE;
}

// Lee IMU con offsets de calibración aplicados
static void imuRead(float &ax, float &ay, float &az,
                    float &gx, float &gy, float &gz) {
  imuReadRaw(ax, ay, az, gx, gy, gz);
  // Accel: restar offset → cuando nivelado, ax=0 ay=0 az=1g
  ax -= accelOff[0];
  ay -= accelOff[1];
  az -= accelOff[2];  // accelOff[2] = az_promedio - 1.0f
  // Gyro: restar bias de reposo
  gx -= gyroBias[0];
  gy -= gyroBias[1];
  gz -= gyroBias[2];
}

// Calibración completa: acelerómetro + giroscopio (~2 s)
// Requiere dron nivelado y en reposo. Guarda offsets en NVS.
static void calibrateIMU(uint8_t clientId) {
  ws.sendTXT(clientId, "{\"calibStatus\":\"running\"}");
  LOG("[CAL] Calibrando IMU — no mover el dron (~2s)...\n");

  const int N = 250;
  double sax=0, say=0, saz=0, sgx=0, sgy=0, sgz=0;
  float ax, ay, az, gx, gy, gz;

  for (int i = 0; i < N; i++) {
    imuReadRaw(ax, ay, az, gx, gy, gz);
    sax += ax; say += ay; saz += az;
    sgx += gx; sgy += gy; sgz += gz;
    delay(4);
    if (i % 25 == 0) ws.loop();  // mantiene el WebSocket vivo durante la espera
  }

  accelOff[0] = (float)(sax / N);          // offset ax  (idealmente 0)
  accelOff[1] = (float)(say / N);          // offset ay  (idealmente 0)
  accelOff[2] = (float)(saz / N) - 1.0f;  // offset az  (idealmente az=1g, offset=desviación)
  gyroBias[0] = (float)(sgx / N);
  gyroBias[1] = (float)(sgy / N);
  gyroBias[2] = (float)(sgz / N);

  saveCalibration();

  // Resetear ángulos y PID con los nuevos offsets aplicados
  pidRoll.reset(); pidPitch.reset(); pidYaw.reset();
  imuRead(ax, ay, az, gx, gy, gz);
  rollAngle  = atan2f(ay, az)                    * RAD_TO_DEG;
  pitchAngle = atan2f(-ax, sqrtf(ay*ay + az*az)) * RAD_TO_DEG;

  char buf[160];
  snprintf(buf, sizeof(buf),
    "{\"calibStatus\":\"done\","
    "\"ax\":%.4f,\"ay\":%.4f,\"az\":%.4f,"
    "\"gx\":%.4f,\"gy\":%.4f,\"gz\":%.4f,"
    "\"roll\":%.2f,\"pitch\":%.2f}",
    accelOff[0], accelOff[1], accelOff[2],
    gyroBias[0], gyroBias[1], gyroBias[2],
    rollAngle, pitchAngle);
  ws.broadcastTXT(buf);

  LOG("[CAL] Accel offsets: %.4f  %.4f  %.4f\n", accelOff[0], accelOff[1], accelOff[2]);
  LOG("[CAL] Gyro bias:     %.4f  %.4f  %.4f\n", gyroBias[0], gyroBias[1], gyroBias[2]);
  LOG("[CAL] Angulos post-cal: roll=%.2f pitch=%.2f\n", rollAngle, pitchAngle);
}

// Calibración rápida de giroscopio al arrancar (sin guardar — temperatura variable)
static void calibrateGyroStartup() {
  LOG("[IMU] Calibrando giroscopio al inicio...\n");
  const int N = 250;
  double sx=0, sy=0, sz=0;
  float ax, ay, az, gx, gy, gz;
  for (int i = 0; i < N; i++) {
    imuReadRaw(ax, ay, az, gx, gy, gz);
    sx += gx; sy += gy; sz += gz;
    delay(4);
  }
  gyroBias[0] = sx / N;
  gyroBias[1] = sy / N;
  gyroBias[2] = sz / N;
  LOG("[IMU] Bias gyro: %.3f  %.3f  %.3f °/s\n", gyroBias[0], gyroBias[1], gyroBias[2]);
}

// ── Motor control ─────────────────────────────────────────────────────────────

static void writeMotors(uint8_t fl, uint8_t fr, uint8_t bl, uint8_t br) {
  motorVals[0] = fl; motorVals[1] = fr;
  motorVals[2] = bl; motorVals[3] = br;
  analogWrite(PIN_MOTOR_FL, fl);
  analogWrite(PIN_MOTOR_FR, fr);
  analogWrite(PIN_MOTOR_BL, bl);
  analogWrite(PIN_MOTOR_BR, br);
}

static void stopMotors() { writeMotors(0, 0, 0, 0); }

// Mezcla X-config con correcciones PID
static void applyStabilized(uint8_t t, float corrY, float corrP, float corrR) {
  auto clamp = [](float v) -> uint8_t {
    return (uint8_t)constrain((int)v, 0, PWM_MAX);
  };
  writeMotors(
    clamp(t - corrR + corrP + corrY),  // FL (CW)
    clamp(t + corrR + corrP - corrY),  // FR (CCW)
    clamp(t - corrR - corrP - corrY),  // BL (CCW)
    clamp(t + corrR - corrP + corrY)   // BR (CW)
  );
}

// ── Setpoints del joystick ────────────────────────────────────────────────────

static uint8_t joy_t = 0;
static int8_t  joy_y = 0, joy_p = 0, joy_r = 0;

// ── WebSocket handler ─────────────────────────────────────────────────────────

static void onWsEvent(uint8_t id, WStype_t type, uint8_t *payload, size_t len) {
  switch (type) {

  case WStype_CONNECTED:
    LOG("[WS] Cliente %d conectado desde %s\n", id, ws.remoteIP(id).toString().c_str());
    break;

  case WStype_DISCONNECTED:
    LOG("[WS] Cliente %d desconectado\n", id);
    stopMotors();
    armed = false; rawMode = false;
    break;

  case WStype_TEXT: {
    JsonDocument doc;
    if (deserializeJson(doc, payload, len)) break;

    const char *cmd = doc["cmd"] | "";

    if (strcmp(cmd, "arm") == 0) {
      armed = true; rawMode = false;
      pidRoll.reset(); pidPitch.reset(); pidYaw.reset();
      LOG("[WS] Armado\n");

    } else if (strcmp(cmd, "disarm") == 0) {
      armed = false; rawMode = false;
      stopMotors();
      LOG("[WS] Desarmado\n");

    } else if (strcmp(cmd, "stby") == 0) {
      bool val = doc["val"] | false;
      stbyEnabled = val;
      digitalWrite(PIN_STBY, val ? HIGH : LOW);
      if (!val) { stopMotors(); armed = false; rawMode = false; }
      LOG("[WS] STBY %s\n", val ? "ON" : "OFF");

    } else if (strcmp(cmd, "move") == 0 && armed) {
      rawMode = false;
      joy_t = doc["t"] | 0;
      joy_y = doc["y"] | 0;
      joy_p = doc["p"] | 0;
      joy_r = doc["r"] | 0;

    } else if (strcmp(cmd, "raw") == 0 && armed) {
      rawMode = true;
      writeMotors(doc["fl"] | 0, doc["fr"] | 0,
                  doc["bl"] | 0, doc["br"] | 0);

    } else if (strcmp(cmd, "calibrate") == 0) {
      if (armed) {
        ws.sendTXT(id, "{\"calibStatus\":\"error\",\"msg\":\"Desarma antes de calibrar\"}");
      } else {
        calibrateIMU(id);
      }
    }
    break;
  }

  default: break;
  }
}

// ── Setup / Loop ──────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);

  pinMode(PIN_STBY, OUTPUT);
  digitalWrite(PIN_STBY, LOW);
  LOG("STBY pin %d (LOW)\n", PIN_STBY);

  analogWriteResolution(PWM_BITS);
  analogWriteFrequency(PWM_FREQ);
  for (uint8_t pin : motorPins) { pinMode(pin, OUTPUT); analogWrite(pin, 0); }
  LOG("Motores en pines %d %d %d %d\n", PIN_MOTOR_FL, PIN_MOTOR_FR, PIN_MOTOR_BL, PIN_MOTOR_BR);

  // ── IMU ────────────────────────────────────────────────────────────────────
  Wire.begin(IMU_SDA, IMU_SCL);
  Wire.setClock(400000);
  delay(100);
  imuOk = imuInit();
  if (imuOk) {
    loadCalibration();        // carga offsets de accel guardados en NVS
    calibrateGyroStartup();   // calibra giroscopio fresco (drift con temperatura)

    float ax, ay, az, gx, gy, gz;
    imuRead(ax, ay, az, gx, gy, gz);
    rollAngle  = atan2f(ay, az)                    * RAD_TO_DEG;
    pitchAngle = atan2f(-ax, sqrtf(ay*ay + az*az)) * RAD_TO_DEG;
    LOG("[IMU] Angulos iniciales: roll=%.2f pitch=%.2f\n", rollAngle, pitchAngle);
  }
  LOG("[IMU] %s\n", imuOk ? "OK" : "FALLO — vuelo sin estabilizacion");

  // ── WiFi ───────────────────────────────────────────────────────────────────
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  LOG("Conectando a %s", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) { delay(500); LOG("."); }
  LOG("\nIP: %s\n", WiFi.localIP().toString().c_str());

  MDNS.begin(MDNS_NAME);
  MDNS.addService("ws", "tcp", WS_PORT);
  LOG("mDNS: ws://%s.local:%d\n", MDNS_NAME, WS_PORT);

  ws.begin();
  ws.onEvent(onWsEvent);
  LOG("WebSocket en puerto %d\n", WS_PORT);
}

static uint32_t lastImuMs = 0;

void loop() {
  uint32_t now = millis();
  ws.loop();

  // ── Loop IMU + PID (~250 Hz) ───────────────────────────────────────────────
  if (imuOk && (now - lastImuMs >= IMU_UPDATE_MS)) {
    float dt = (now - lastImuMs) * 0.001f;
    lastImuMs = now;

    float ax, ay, az, gx, gy, gz;
    imuRead(ax, ay, az, gx, gy, gz);

    float accelRoll  = atan2f(ay, az)                    * RAD_TO_DEG;
    float accelPitch = atan2f(-ax, sqrtf(ay*ay + az*az)) * RAD_TO_DEG;

    rollAngle  = COMP_ALPHA * (rollAngle  + gx * dt) + (1.0f - COMP_ALPHA) * accelRoll;
    pitchAngle = COMP_ALPHA * (pitchAngle + gy * dt) + (1.0f - COMP_ALPHA) * accelPitch;
    yawRate    = gz;

    if (armed && !rawMode) {
      float spRoll  = joy_r * (MAX_ANGLE    / 127.0f);
      float spPitch = joy_p * (MAX_ANGLE    / 127.0f);
      float spYaw   = joy_y * (MAX_YAW_RATE / 127.0f);

      float corrR = pidRoll .compute(spRoll,  rollAngle,  dt);
      float corrP = pidPitch.compute(spPitch, pitchAngle, dt);
      float corrY = pidYaw  .compute(spYaw,   yawRate,    dt);

      applyStabilized(joy_t, corrY, corrP, corrR);
    }
    // rawMode=true: PID pausado, valores del ultimo cmd "raw" persisten en motores
  }

  // ── Telemetría → app cada 100 ms ──────────────────────────────────────────
  if (millis() - lastStatusMs >= STATUS_MS) {
    lastStatusMs = millis();
    char buf[160];
    snprintf(buf, sizeof(buf),
      "{\"motors\":[%d,%d,%d,%d],\"armed\":%s,\"stby\":%s,"
      "\"roll\":%.1f,\"pitch\":%.1f,\"imu\":%s}",
      motorVals[0], motorVals[1], motorVals[2], motorVals[3],
      armed ? "true" : "false", stbyEnabled ? "true" : "false",
      rollAngle, pitchAngle, imuOk ? "true" : "false");
    ws.broadcastTXT(buf);
  }
}
