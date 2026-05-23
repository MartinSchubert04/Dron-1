import cv2
import numpy as np
import urllib.request
import threading
import time
import sys
from ultralytics import YOLO

# --- Configuración ---
URL = 'http://192.168.1.74/cam-hi.jpg'
# 'yolov8n.pt' es la versión Nano: la más rápida para CPUs y drones.
# Se descargará automáticamente la primera vez que lo corras.
MODEL_NAME = 'yolov8n.pt' 

# Cargar modelo
model = YOLO(MODEL_NAME)

# --- Variables Globales ---
frame = None
last_results = []
inference_time = 0
cam_fps = 0  
lock = threading.Lock()
results_lock = threading.Lock()
running = True 

def detect_objects(img):
    """Realiza la detección usando YOLOv8"""
    start_t = time.time()
    
    # Ejecutar inferencia
    # stream=True es más eficiente para video
    # classes=[0] detectaría solo personas. Si quieres todo, quita ese argumento.
    results = model.predict(source=img, conf=0.45, verbose=False)
    
    detections = []
    if results:
        result = results[0]
        # Extraer cajas, nombres de clases y confianzas
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
            w, h = x2 - x1, y2 - y1
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            label = result.names[cls_id]
            
            detections.append(([x1, y1, w, h], label, conf))
    
    return detections, (time.time() - start_t) * 1000

def draw_metrics(img, results, v_fps, c_fps, proc_time):
    """Dibuja cajas y panel de telemetría"""
    for (x, y, w, h), label, conf in results:
        # Dibujar caja
        cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
        # Etiqueta con confianza
        text = f'{label} {conf:.2f}'
        cv2.putText(img, text, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    
    # Panel de métricas con transparencia
    overlay = img.copy()
    cv2.rectangle(overlay, (0, 0), (250, 100), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.7, img, 0.3, 0, img)

    cv2.putText(img, f"Window FPS: {v_fps:.1f}", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    cv2.putText(img, f"CAM FPS: {c_fps:.1f}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 1)
    cv2.putText(img, f"INF Time: {proc_time:.1f}ms", (10, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 1)
    return img

def capture():
    global frame, running, cam_fps
    last_frame_time = time.time()
    
    while running:
        try:
            img_resp = urllib.request.urlopen(URL, timeout=1)
            imgnp = np.array(bytearray(img_resp.read()), dtype=np.uint8)
            img = cv2.imdecode(imgnp, -1)
            
            if img is not None:
                now = time.time()
                diff = now - last_frame_time
                if diff > 0:
                    cam_fps = 1.0 / diff
                last_frame_time = now

                with lock:
                    frame = img
        except Exception as e:
            time.sleep(0.1)

def detect():
    global running, inference_time
    while running:
        img = None
        with lock:
            if frame is not None:
                img = frame.copy()

        if img is not None:
            res, t = detect_objects(img)
            with results_lock:
                last_results.clear()
                last_results.extend(res)
                inference_time = t
        else:
            time.sleep(0.01)

def show():
    global running
    cv2.namedWindow("YOLOv8 Detection")
    prev_time = time.time()

    while running:
        if cv2.getWindowProperty("YOLOv8 Detection", cv2.WND_PROP_VISIBLE) < 1:
            running = False
            break

        curr_time = time.time()
        v_fps = 1 / (curr_time - prev_time) if (curr_time - prev_time) > 0 else 0
        prev_time = curr_time

        raw = None
        with lock:
            if frame is not None:
                raw = frame.copy()
        
        if raw is not None:
            with results_lock:
                res = list(last_results)
                p_time = inference_time
                c_fps = cam_fps 
            
            out = draw_metrics(raw, res, v_fps, c_fps, p_time)
            cv2.imshow("YOLOv8 Detection", out)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            running = False
            break

    cv2.destroyAllWindows()

if __name__ == '__main__':
    print(f"Iniciando YOLOv8 ({MODEL_NAME})...")
    
    t1 = threading.Thread(target=capture, daemon=True)
    t2 = threading.Thread(target=detect, daemon=True)
    
    t1.start()
    t2.start()
    
    show() 
    
    running = False
    print("Sistema apagado.")
    sys.exit(0)