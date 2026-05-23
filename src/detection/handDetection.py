import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import urllib.request
import numpy as np
import threading
import time
import sys
import os

# Configuración de logs para limpiar la consola
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

URL = 'http://192.168.1.74/cam-hi.jpg'

# --- Configuración Dinámica de Ruta del Modelo ---
# Esto asegura que encuentre el archivo .task si está en la misma carpeta que este script .py
script_dir = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(script_dir, 'hand_landmarker.task')

# Verificar si el modelo existe antes de empezar
if not os.path.exists(MODEL_PATH):
    print(f"ERROR: No se encontró el archivo del modelo en: {MODEL_PATH}")
    print("Por favor descarga 'hand_landmarker.task' y colócalo en esa carpeta.")
    sys.exit(1)

# --- Inicialización de MediaPipe Tasks ---
base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.VIDEO, # Optimizado para streaming
    num_hands=2,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5
)
detector = vision.HandLandmarker.create_from_options(options)

# Definir las conexiones de la mano (dedos y palma) para dibujar las líneas
HAND_CONNECTIONS = [
    # Palma
    (0, 1), (1, 2), (2, 3), (3, 4),    # Pulgar
    (0, 5), (5, 6), (6, 7), (7, 8),    # Índice
    (5, 9), (9, 10), (10, 11), (11, 12), # Medio
    (9, 13), (13, 14), (14, 15), (15, 16), # Anular
    (13, 17), (17, 18), (18, 19), (19, 20), # Meñique
    (0, 17) # Base de la palma
]

# --- Variables Globales ---
frame = None
detection_result = None
inference_time = 0
cam_fps = 0
lock = threading.Lock()
running = True

def capture():
    global frame, running, cam_fps
    last_time = time.time()
    while running:
        try:
            img_resp = urllib.request.urlopen(URL, timeout=1)
            imgnp = np.array(bytearray(img_resp.read()), dtype=np.uint8)
            img = cv2.imdecode(imgnp, -1)
            if img is not None:
                now = time.time()
                cam_fps = 1.0 / (now - last_time) if (now - last_time) > 0 else 0
                last_time = now
                with lock:
                    frame = img
        except:
            time.sleep(0.1)

def detect():
    global detection_result, inference_time, running
    while running:
        img = None
        with lock:
            if frame is not None:
                img = frame.copy()

        if img is not None:
            start_t = time.time()
            
            # Convertir a formato MediaPipe Image
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
            
            # Timestamp necesario para modo VIDEO
            timestamp_ms = int(time.time() * 1000)
            result = detector.detect_for_video(mp_image, timestamp_ms)
            
            detection_result = result
            inference_time = (time.time() - start_t) * 1000
        else:
            time.sleep(0.01)

def draw_landmarks_and_connections(image, detection_result):
    """Dibuja puntos y líneas de conexión manualmente."""
    if not detection_result or not detection_result.hand_landmarks:
        return image

    h, w, _ = image.shape

    for landmarks in detection_result.hand_landmarks:
        # 1. Convertir coordenadas normalizadas a píxeles
        pixel_landmarks = []
        for lm in landmarks:
            px_x = int(lm.x * w)
            px_y = int(lm.y * h)
            pixel_landmarks.append((px_x, px_y))

        # 2. Dibujar las líneas de conexión (esqueleto)
        for connection in HAND_CONNECTIONS:
            start_idx = connection[0]
            end_idx = connection[1]
            
            # Asegurarse de que los índices son válidos
            if start_idx < len(pixel_landmarks) and end_idx < len(pixel_landmarks):
                cv2.line(image, pixel_landmarks[start_idx], pixel_landmarks[end_idx], 
                         (255, 255, 255), 2) # Línea blanca

        # 3. Dibujar los puntos (landmarks) sobre las líneas
        for landmark_px in pixel_landmarks:
            cv2.circle(image, landmark_px, 4, (0, 255, 0), -1) # Punto verde

    return image

def show():
    global running
    cv2.namedWindow("Hand Tracking Mejorado")
    prev_time = time.time()

    while running:
        # Verificar si la ventana se cerró
        if cv2.getWindowProperty("Hand Tracking Mejorado", cv2.WND_PROP_VISIBLE) < 1:
            running = False
            break

        curr_time = time.time()
        v_fps = 1 / (curr_time - prev_time) if (curr_time - prev_time) > 0 else 0
        prev_time = curr_time

        with lock:
            if frame is None: continue
            out = frame.copy()

        # Dibujar resultados mejorados (puntos y líneas)
        if detection_result:
            out = draw_landmarks_and_connections(out, detection_result)

        # Métricas
        cv2.rectangle(out, (0,0), (220, 100), (0,0,0), -1)
        cv2.putText(out, f"Window FPS: {v_fps:.1f}", (10, 25), 2, 0.6, (255,255,255), 1)
        cv2.putText(out, f"CAM FPS: {cam_fps:.1f}", (10, 50), 2, 0.6, (0,200,255), 1)
        cv2.putText(out, f"Process time: {inference_time:.1f}ms", (10, 75), 2, 0.6, (0,255,0), 1)

        cv2.imshow("Hand Tracking Mejorado", out)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            running = False

    cv2.destroyAllWindows()

if __name__ == '__main__':
    # Iniciar hilos de captura y detección
    t1 = threading.Thread(target=capture, daemon=True)
    t2 = threading.Thread(target=detect, daemon=True)
    t1.start()
    t2.start()
    # Mostrar resultados en el hilo principal
    show()
    sys.exit(0)