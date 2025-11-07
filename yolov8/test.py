from ultralytics import YOLO
import cv2

# Load your trained model
model = YOLO(r"C:\Users\Edrian\Documents\VSCodeProjects\CaniScan\runs\detect\train8\weights\best.pt")

# Run prediction
results = model.predict(
    source=r"C:\Users\Edrian\Documents\VSCodeProjects\CaniScan\dataset\test\images\1-27-_png_jpg.rf.f16144443a06e6fc35b195dcb6c35230.jpg",
    show=True,
    save=True
)

# === Keep the window open ===
print("Press any key on the image window to close...")

# This line keeps the window open until a key is pressed
cv2.waitKey(0)

# Close all OpenCV windows after a key press
cv2.destroyAllWindows()
