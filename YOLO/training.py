import multiprocessing
from ultralytics import YOLO
import torch
import os

def main():

    # Configuration Section
    yolo_version = "11"   # Options: "v8" or "11"
    model_size = "n"      # Options: "n", "s", "m", "l", "x"
    epochs = 30
    data_path = "YOLO/config.yaml"

    # Auto-generate model name (e.g., yolov8n.pt or yolov11s.pt)
    model_name = f"yolo{yolo_version}{model_size}.pt"

    # Clear GPU cache before training
    torch.cuda.empty_cache()

    # Detect GPU availability, use GPU for training if available else CPU
    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"🔥 GPU is available: {torch.cuda.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        print("⚠️ GPU not detected — using CPU instead.")

    # Load YOLO model
    try:
        model = YOLO(model_name)
        print(f"✅ Loaded model: {model_name}")
    except Exception as e:
        print(f"❌ Failed to load model '{model_name}': {e}")
        return

    # Create organized folder structure: runs/v8/s/ or runs/v11/n/
    base_dir = "runs"
    version_dir = os.path.join(base_dir, yolo_version, model_size)
    os.makedirs(version_dir, exist_ok=True)

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
        data=data_path,
        epochs=30,           # You can increase this (e.g., 50–100) for better results
        imgsz=640,           # Resize images to 640x640
        batch=-1,            # Auto batch size (based on available VRAM)
        device=device,
        workers=4,           # Number of CPU workers for loading data
        verbose=True,        # Show detailed progress
        project=version_dir, # saves inside runs/v8/ or runs/v11/
        name="train_results" # subfolder name
    )

    # ✅ Print training summary
    print("\nTraining Complete!")
    print(f"Results saved in: {version_dir}")
    print(results)


# Required for Windows multiprocessing
if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()