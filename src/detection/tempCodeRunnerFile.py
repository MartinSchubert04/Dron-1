import cv2
import mediapipe as mp
import urllib.request
import numpy as np
import threading
import time
import sys

import os

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Oculta logs de TensorFlow
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0' # Apaga las operaciones customizadas de oneDNN

URL = 'http://192.168.1.74/cam-hi.jpg'

# --- Inicialización de MediaPipe Hands ---
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
# static_image_mode=False es mejor para video (hace tracking)
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# --- Variables Globales ---
frame = None
hand_landmarks_results = None
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
    global hand_landmarks_results, inference_time, running
    while running:
        img = None
        with lock:
            if frame is not None:
                img = frame.copy()

        if img is not None:
            start_t = time.time()
            
            # MediaPipe trabaja en RGB, OpenCV en BGR
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            results = hands.process(img_rgb)
            
            hand_landmarks_results = results
            inference_time = (time.time() - start_t) * 1000
        else:
            time.sleep(0.01)

def show():
    global running
    cv2.namedWindow("Hand Tracking")
    prev_time = time.time()

    while running:
        if cv2.getWindowProperty("Hand Tracking", cv2.WND_PROP_VISIBLE) < 1:
            running = False
            break

        curr_time = time.time()
        v_fps = 1 / (curr_time - prev_time) if (curr_time - prev_time) > 0 else 0
        prev_time = curr_time

        with lock:
            if frame is None: continue
            out = frame.copy()

        # Dibujar los puntos si existen resultados
        if hand_landmarks_results and hand_landmarks_results.multi_hand_landmarks:
            for hand_landmarks in hand_landmarks_results.multi_hand_landmarks:
                # Esto dibuja los puntos y las conexiones automáticamente
                mp_drawing.draw_landmarks(
                    out, 
                    hand_landmarks, 
                    mp_hands.HAND_CONNECTIONS,
                    mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2), # Puntos
                    mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=2) # Líneas
                )

        # Métricas
        cv2.rectangle(out, (0,0), (220, 100), (0,0,0), -1)
        cv2.putText(out, f"V-FPS: {v_fps:.1f}", (10, 25), 2, 0.6, (255,255,255), 1)
        cv2.putText(out, f"C-FPS: {cam_fps:.1f}", (10, 50), 2, 0.6, (0,200,255), 1)
        cv2.putText(out, f"INF: {inference_time:.1f}ms", (10, 75), 2, 0.6, (0,255,0), 1)

        cv2.imshow("Hand Tracking", out)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            running = False

    cv2.destroyAllWindows()

if __name__ == '__main__':
    t1 = threading.Thread(target=capture, daemon=True)
    t2 = threading.Thread(target=detect, daemon=True)
    t1.start()
    t2.start()
    show()
    sys.exit(0)