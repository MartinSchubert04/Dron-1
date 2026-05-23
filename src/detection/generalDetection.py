import cv2
import numpy as np
import urllib.request
import threading
import time
import sys

URL     = 'http://192.168.1.74/cam-hi.jpg'
CFG     = r'C:\Users\Martin\.cvlib\yolov4.cfg'
WEIGHTS = r'C:\Users\Martin\.cvlib\yolov4.weights'
CLASSES = r'C:\Users\Martin\.cvlib\yolov3.txt'

net = cv2.dnn.readNet(WEIGHTS, CFG)
net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

with open(CLASSES, 'r') as f:
    class_names = [line.strip() for line in f.readlines()]

layer_names   = net.getLayerNames()
output_layers = [layer_names[i - 1] for i in net.getUnconnectedOutLayers()]

frame          = None
last_results   = []
inference_time = 0
cam_fps        = 0  
lock           = threading.Lock()
results_lock   = threading.Lock()
running        = True 

def detect_objects(img):
    start_t = time.time()
    h, w = img.shape[:2]
    blob = cv2.dnn.blobFromImage(img, 1/255.0, (416, 416), swapRB=True, crop=False)
    net.setInput(blob)
    outputs = net.forward(output_layers)

    boxes, confidences, class_ids = [], [], []
    for output in outputs:
        for det in output:
            scores   = det[5:]
            class_id = np.argmax(scores)
            conf     = scores[class_id]
            if conf > 0.5:
                cx, cy, bw, bh = (det[:4] * [w, h, w, h]).astype(int)
                x, y = cx - bw // 2, cy - bh // 2
                boxes.append([x, y, bw, bh])
                confidences.append(float(conf))
                class_ids.append(class_id)

    indices = cv2.dnn.NMSBoxes(boxes, confidences, 0.5, 0.4)
    results = []
    if len(indices) > 0:
        for i in indices.flatten():
            results.append((boxes[i], class_names[class_ids[i]], confidences[i]))
    
    return results, (time.time() - start_t) * 1000

def draw_metrics(img, results, v_fps, c_fps, proc_time):
    for (x, y, w, h), label, conf in results:
        cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
        cv2.putText(img, f'{label}', (x, y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    
    overlay = img.copy()
    cv2.rectangle(overlay, (0, 0), (240, 100), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, img, 0.4, 0, img)

    cv2.putText(img, f"Window FPS: {v_fps:.1f}", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(img, f"CAM FPS: {c_fps:.1f}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 2)
    cv2.putText(img, f"Process time: {proc_time:.1f}ms", (10, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    return img

def capture():
    global frame, running, cam_fps
    last_frame_time = time.time()
    
    while running:
        try:
            img_resp = urllib.request.urlopen(URL, timeout=1)
            imgnp    = np.array(bytearray(img_resp.read()), dtype=np.uint8)
            img      = cv2.imdecode(imgnp, -1)
            
            if img is not None:
                # Calcular Cam FPS
                now = time.time()
                diff = now - last_frame_time
                if diff > 0:
                    cam_fps = 1.0 / diff
                last_frame_time = now

                with lock:
                    frame = img
        except:
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
    cv2.namedWindow("detection")
    prev_time = time.time()

    while running:
        if cv2.getWindowProperty("detection", cv2.WND_PROP_VISIBLE) < 1:
            running = False
            break

        curr_time = time.time()
        v_fps = 1 / (curr_time - prev_time) if (curr_time - prev_time) > 0 else 0
        prev_time = curr_time

        with lock:
            raw = frame.copy() if frame is not None else None
        
        with results_lock:
            res = list(last_results)
            p_time = inference_time
            c_fps = cam_fps 
        if raw is not None:
            out = draw_metrics(raw, res, v_fps, c_fps, p_time)
            cv2.imshow("detection", out)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            running = False
            break

    cv2.destroyAllWindows()

if __name__ == '__main__':
    print("Iniciando sistema... Presiona 'q' o cierra la ventana para salir.")
    
    t1 = threading.Thread(target=capture, daemon=True)
    t2 = threading.Thread(target=detect, daemon=True)
    
    t1.start()
    t2.start()
    
    show() 
    
    running = False
    print("Proceso finalizado correctamente.")
    sys.exit(0)