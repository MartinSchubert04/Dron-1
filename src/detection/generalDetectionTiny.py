import cv2
import numpy as np
import urllib.request
import threading
import time

URL     = 'http://192.168.1.74/cam-hi.jpg'
CFG     = r'C:\Users\Martin\.cvlib\yolov4-tiny.cfg'
WEIGHTS = r'C:\Users\Martin\.cvlib\yolov4-tiny.weights'
CLASSES = r'C:\Users\Martin\.cvlib\yolov3.txt'

net = cv2.dnn.readNet(WEIGHTS, CFG)
net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

with open(CLASSES, 'r') as f:
    class_names = [line.strip() for line in f.readlines()]

layer_names   = net.getLayerNames()
output_layers = [layer_names[i - 1] for i in net.getUnconnectedOutLayers()]

frame        = None
last_results = []
lock         = threading.Lock()
results_lock = threading.Lock()
running      = True


def detect_objects(img):
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
    return results


def draw_detections(img, results):
    for (x, y, w, h), label, conf in results:
        cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
        cv2.putText(img, f'{label} {conf:.2f}', (x, y - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    return img


def capture():
    global frame, running
    while running:
        try:
            img_resp = urllib.request.urlopen(URL, timeout=2)
            imgnp    = np.array(bytearray(img_resp.read()), dtype=np.uint8)
            img      = cv2.imdecode(imgnp, -1)
            if img is None:
                continue
            with lock:
                frame = img
        except Exception as e:
            print(f"Capture error: {e}")


def detect():
    global running
    while running:
        with lock:
            img = frame.copy() if frame is not None else None

        if img is not None:
            results = detect_objects(img)
            with results_lock:
                last_results.clear()
                last_results.extend(results)

        time.sleep(0.01)


def show():
    global running
    cv2.namedWindow("detection", cv2.WINDOW_AUTOSIZE)

    while running:
        with lock:
            raw = frame.copy() if frame is not None else None
        with results_lock:
            res = list(last_results)

        if raw is not None:
            out = draw_detections(raw, res)
            cv2.imshow("detection", out)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            running = False

    cv2.destroyAllWindows()


if __name__ == '__main__':
    print("Modelo cargado. Iniciando...")
    t1 = threading.Thread(target=capture)
    t2 = threading.Thread(target=detect)
    t3 = threading.Thread(target=show)

    t1.start()
    t2.start()
    t3.start()

    t1.join()
    t2.join()
    t3.join()