import sys
import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

# Load model một lần ở global scope
model = YOLO("./FireDetection.pt")
annotator = sv.BoxAnnotator()

def process_frame(frame_data):
    try:
        # Decode ảnh từ buffer
        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Không thể decode frame")

        # Resize ảnh để tăng tốc độ xử lý
        frame = cv2.resize(frame, (640, 480))

        # Thực hiện detect
        results = model(frame)[0]
        detections = sv.Detections.from_ultralytics(results)
        frame = annotator.annotate(scene=frame, detections=detections)

        # Encode lại ảnh
        _, encoded_img = cv2.imencode('.jpg', frame)
        return encoded_img.tobytes()
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
        return None

if __name__ == "__main__":
    try:
        frame_data = sys.stdin.buffer.read()
        if not frame_data:
            raise ValueError("Không nhận được dữ liệu input")
            
        processed_frame = process_frame(frame_data)
        if processed_frame is None:
            sys.exit(1)
            
        sys.stdout.buffer.write(processed_frame)
        sys.stdout.buffer.flush()
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
        sys.exit(1)