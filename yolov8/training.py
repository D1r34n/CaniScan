import multiprocessing
from ultralytics import YOLO
import torch

def main():
    # Clear GPU cache before training
    torch.cuda.empty_cache()

    # Create a new YOLO model from scratch using YOLOv8 Nano or smallest version
    model = YOLO("yolov8n.pt")  # or "yolov8s.pt"

    # Detect GPU availability, use GPU for training if available else CPU
    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"🔥 GPU is available: {torch.cuda.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        print("⚠️ GPU not detected — using CPU instead.")

    # Train the model using the 'config.yaml' dataset for 3 epochs

    # What is epoch? (If asked by panels)
    # Epochs refer to the number of times the entire training dataset is 
    # passed through the model during training. Increasing the number of epochs can lead to 
    # improved model performance, as it allows the model to see the data multiple times and 
    # learn more effectively.

    # HOWEVER, using higher number of epochs may overfit the data which is a downside

    # Therefore when we mean 3 epochs, YOLO will train it 3 times
    # Sa tagalog putang ina uulitin lang ng YOLO yung training ng tatlong beses 
    # hindot pag di mo pa naintindihan to ewan nalang

    # Now what is the best number of epoch for training data? (we need research or reference)
    # for this one.
    # ✅ Train the model
    results = model.train(
        data="yolov8/config.yaml",
        epochs=30,           # You can increase this (e.g., 50–100) for better results
        imgsz=640,           # Resize images to 640x640
        batch=-1,            # Auto batch size (based on available VRAM)
        device=device,
        workers=4,           # Number of CPU workers for loading data
        verbose=True         # Show detailed progress
    )

    # ✅ Print training summary
    print("\n✅ Training Complete!")
    print(results)


# Required for Windows multiprocessing
if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()