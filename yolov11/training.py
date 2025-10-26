import multiprocessing
from ultralytics import YOLO
import torch
torch.cuda.empty_cache()
def main():
    # Create a new YOLO model from scratch using YOLOv8 Nano or smallest version
    model = YOLO("yolov8n.pt")  # or "yolov8s.pt"

    # Use GPU CUDA NVIDIA FOR 
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print("Training on device:", device)

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
    results = model.train(
        data=r"C:\Users\Edrian\Documents\VSCodeProjects\CaniScan\yolov8\config.yaml",
        epochs=30,
        imgsz=640,          # Reduce image size if needed (e.g., 512)
        batch=-1,            # This will trigger the autobatch feature, which calculates the maximum batch size that can run on your device.
        device=device,
        workers=4
    )

# Required for Windows multiprocessing
if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()