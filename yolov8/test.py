from ultralytics import YOLO
import cv2

# Load your trained model
model = YOLO(r"runs\detect\train\weights\best.pt")

# Run prediction
results = model.predict(
    source=r"C:\Users\Edrian\Downloads\two_disease2.png",
    show=True,
    save=True
)

# === Keep the window open ===
print("Press any key on the image window to close...")

# This line keeps the window open until a key is pressed
cv2.waitKey(0)

# Close all OpenCV windows after a key press
cv2.destroyAllWindows()
