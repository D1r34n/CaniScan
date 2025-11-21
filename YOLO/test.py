from ultralytics import YOLO
import cv2

# Load your trained model
model = YOLO(r"C:\Users\Edrian\Documents\VSCodeProjects\CaniScan\runs\v8\n\train_results2\weights\best.pt")

# Run prediction
results = model.predict(
    source=r"C:\Users\Edrian\Documents\VSCodeProjects\CaniScan\uploads\7e289892-f653-43be-a5a0-f97e3f74d0a3.jpg",
    show=True,
    save=True
)

# === Keep the window open ===
print("Press any key on the image window to close...")

# This line keeps the window open until a key is pressed
cv2.waitKey(0)

# Close all OpenCV windows after a key press
cv2.destroyAllWindows()
