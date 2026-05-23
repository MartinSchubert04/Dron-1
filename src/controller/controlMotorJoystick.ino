/*
Controlar velocidad de motores (de forma conjunta o individual dependiendo implementacion en hardware)
*/

#include <Bluepad32.h>

GamepadPtr myGamepad;

const int pwmPin = 18;
const int pwmPin2 = 19;
const int pwmChannel = 0;
const int pwmChannel2 = 1;
const int pwmFreq = 20000;
const int pwmResolution = 8;
const int DEAD_ZONE = 10;

void onConnectedGamepad(GamepadPtr gp) {
  Serial.println("Joystick conectado!");
  myGamepad = gp;
}

void onDisconnectedGamepad(GamepadPtr gp) {
  Serial.println("Joystick desconectado");
  myGamepad = nullptr;
}

void setup() {
  Serial.begin(115200);
  ledcSetup(pwmChannel, pwmFreq, pwmResolution);
  ledcSetup(pwmChannel2, pwmFreq, pwmResolution);
  ledcAttachPin(pwmPin, pwmChannel);
  ledcAttachPin(pwmPin2, pwmChannel2);
  BP32.setup(&onConnectedGamepad, &onDisconnectedGamepad);
  BP32.forgetBluetoothKeys();
}

void loop() {
  bool updated = BP32.update();

  if (updated && myGamepad && myGamepad->isConnected()) {
    int ly = myGamepad->axisY();
    int ry = myGamepad->axisRY();

    int speed  = (ly < -DEAD_ZONE) ? constrain(map(-ly, DEAD_ZONE, 512, 0, 255), 0, 255) : 0;
    int speed2 = (ry < -DEAD_ZONE) ? constrain(map(-ry, DEAD_ZONE, 512, 0, 255), 0, 255) : 0;

    ledcWrite(pwmChannel, speed);
    ledcWrite(pwmChannel2, speed2);

    Serial.printf("LY: %4d → Motor1: %3d | RY: %4d → Motor2: %3d\n", ly, speed, ry, speed2);
  }

  delay(20);
}