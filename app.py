"""
Hand Draw Pro — Flask + OpenCV + MediaPipe backend
Streams processed frames and gesture data via SSE and MJPEG
"""

import cv2
import mediapipe as mp
import numpy as np
import json
import time
import threading
from flask import Flask, render_template, Response, stream_with_context
from gesture import GestureDetector

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# ── MediaPipe setup ──────────────────────────────────────────────
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path='hand_landmarker.task'),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=1,
    min_hand_detection_confidence=0.1,  # Lowered from 0.3
    min_hand_presence_confidence=0.1,   # Lowered from 0.3
    min_tracking_confidence=0.1         # Lowered from 0.3
)

print("Initializing MediaPipe hand landmarker...")
hand_landmarker = HandLandmarker.create_from_options(options)

gesture_detector = GestureDetector()

# ── Shared state (thread-safe via lock) ──────────────────────────
state_lock  = threading.Lock()
latest_data = {
    "gesture": "idle",
    "index_x": 0.5,
    "index_y": 0.5,
    "thumb_x": 0.5,
    "thumb_y": 0.5,
    "mid_x":   0.5,
    "mid_y":   0.5,
    "detected": False,
    "landmarks": []
}
latest_frame = None
frame_lock   = threading.Lock()

# ── Camera capture thread ────────────────────────────────────────
def capture_loop():
    global latest_frame, latest_data
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Could not open camera")
        return
    
    print("Camera opened successfully")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 60)
    cap.set(cv2.CAP_PROP_AUTOFOCUS, 1)
    cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.25)

    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.01)
            continue

        frame = cv2.flip(frame, 1)
        rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = hand_landmarker.detect(mp_image)

        data = {
            "gesture":  "idle",
            "index_x":  0.5, "index_y": 0.5,
            "thumb_x":  0.5, "thumb_y": 0.5,
            "mid_x":    0.5, "mid_y":   0.5,
            "detected": False,
            "landmarks": []
        }

        if result.hand_landmarks:
            lm_list = result.hand_landmarks[0]
            data["detected"] = True

            # Raw normalized coords (already mirrored via flip)
            data["index_x"] = lm_list[8].x
            data["index_y"] = lm_list[8].y
            data["thumb_x"] = lm_list[4].x
            data["thumb_y"] = lm_list[4].y
            data["mid_x"]   = lm_list[12].x
            data["mid_y"]   = lm_list[12].y

            # Detect gesture
            data["gesture"] = gesture_detector.detect(lm_list)

            # Send all 21 landmarks for skeleton rendering in browser
            data["landmarks"] = [
                {"x": lm.x, "y": lm.y} for lm in lm_list
            ]

            # Draw skeleton on preview frame (simplified for new API)
            for landmark in lm_list:
                x = int(landmark.x * frame.shape[1])
                y = int(landmark.y * frame.shape[0])
                cv2.circle(frame, (x, y), 3, (255, 255, 255), -1)  # White color
                cv2.circle(frame, (x, y), 5, (192, 192, 192), 1)    # Silver outline

        with state_lock:
            latest_data = data  # Replace entire data object

        # Encode preview frame
        small = cv2.resize(frame, (320, 240))
        _, buf = cv2.imencode('.jpg', small, [cv2.IMWRITE_JPEG_QUALITY, 75])
        with frame_lock:
            latest_frame = buf.tobytes()

        time.sleep(0.005)  # ~200fps for smoother tracking

# ── Routes ───────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/video_feed')
def video_feed():
    """MJPEG stream of the webcam preview with skeleton overlay."""
    def generate():
        while True:
            with frame_lock:
                frame = latest_frame
            if frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(0.033)  # ~30fps

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/gesture_stream')
def gesture_stream():
    """Server-Sent Events stream of gesture + landmark data."""
    def generate():
        while True:
            with state_lock:
                payload = json.dumps(latest_data)
            yield f"data: {payload}\n\n"
            time.sleep(0.033)

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )


# ── Start ────────────────────────────────────────────────────────
if __name__ == '__main__':
    t = threading.Thread(target=capture_loop, daemon=True)
    t.start()
    print("\n✋  Hand Draw Pro running at http://localhost:5001\n")
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)
