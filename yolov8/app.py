from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import base64
import numpy as np

app = Flask(__name__)
CORS(app)

model = YOLO(r"C:\Users\Edrian\Documents\VSCodeProjects\CaniScan\runs\detect\train2\weights\best.pt")

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    frame_data = data.get('frame').split(',')[1]
    frame_bytes = base64.b64decode(frame_data)
    np_arr = np.frombuffer(frame_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    # Run YOLO prediction
    results = model(img)
    detections = results[0].boxes

    # ✅ Handle no detection
    if detections is None or len(detections) == 0:
        return jsonify({
            'disease': "No disease detected",
            'confidence': 0
        })

    # Otherwise pick the most confident detection
    top_conf_idx = np.argmax(detections.conf.cpu().numpy())
    disease = model.names[int(detections.cls[top_conf_idx])]
    confidence = float(detections.conf[top_conf_idx]) * 100

    return jsonify({
        'disease': disease,
        'confidence': round(confidence, 2)
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000)
