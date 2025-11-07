from ultralytics import YOLO
import cv2

# Load your trained model
model = YOLO(r"runs\detect\train\weights\best.pt")

# Open webcam
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Run YOLOv8 prediction
    results = model(frame, stream=True)

    # Display the results
    for r in results:
        annotated_frame = r.plot()
        cv2.imshow("YOLOv8 Real-Time Detection", annotated_frame)

    # Exit when 'q' is pressed
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
