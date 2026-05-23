## About

### Code used for dron made with a ESP32 microcontroller

## Dependecies

- Arduino-CLI for windows
- Bluepad32

## Intall dependencies

### How to add esp32 boards to arduino IDE and external libs

File -> Preferences

<img width="658" height="431" alt="image" src="https://github.com/user-attachments/assets/4d6c3375-0684-4d7f-ab40-d8019724c9dd" />

add the following URLs

- esp32 Boards: https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
- Bluepad32: https://raw.githubusercontent.com/ricardoquesada/esp32-arduino-lib-builder/master/bluepad32_files/package

Once finish the installation, select the your board (usually is NodeMCU-32s)

<img width="870" height="586" alt="image" src="https://github.com/user-attachments/assets/a2425b23-659d-405a-975a-0c439b8ff519" />

## Hardware & Circuit design

### Components

- esp32s (microcontroller)
- esp32-CAM (microcontroller + camera)
- MPU6050 (accelerometer)
- BMP280 (preasure sensor)
- motor brushed 50k RMP x4

### Pinout tables

| NODEMCU ESP32S | MPU6050     |
| -------------- | ----------- |
| EXAMPLE_PIN    | EXAMPLE_PIN |

### Images

<img width="758" height="468" alt="image" src="https://github.com/user-attachments/assets/053ed140-9026-4e66-b43e-8c7d693d662e" />

<img width="600" height="407" alt="image" src="https://github.com/user-attachments/assets/87dc6426-76cd-407b-8db8-da248653c5a0" />
# Dron
