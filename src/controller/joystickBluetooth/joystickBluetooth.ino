#include <Bluepad32.h>
#include <ESP32Servo.h>


#define SERVO_PIN 18

Servo servo;

GamepadPtr myGamepad;

int pos = 0;
int angle = 90;


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

    servo.attach(SERVO_PIN);

    BP32.setup(&onConnectedGamepad, &onDisconnectedGamepad);
    BP32.forgetBluetoothKeys();
}

void loop() {

    BP32.update();

    if (myGamepad && myGamepad->isConnected()) {

        int lx = myGamepad->axisX();
        int ly = myGamepad->axisY();
        int rx = myGamepad->axisRX();
        int ry = myGamepad->axisRY();

        if (abs(ly) < 30) {
            ly = 0;
        }

        int servoAngle = map(ly, -512, 512, 0, 180);
        servoAngle = constrain(servoAngle, 0, 180);
        servo.write(servoAngle);

        Serial.println(servoAngle);

        Serial.print("LX: ");
        Serial.print(lx);

        Serial.print(" LY: ");
        Serial.print(ly);

        Serial.print(" RX: ");
        Serial.print(rx);

        Serial.print(" RY: ");
        Serial.println(ry);

    }

    delay(50);
}