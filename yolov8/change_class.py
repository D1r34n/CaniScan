import os

project2_annotations = r"C:\Users\Edrian\Downloads\ringworm.v1i.yolov8\train\labels"

for file in os.listdir(project2_annotations):
    if file.endswith(".txt"):
        file_path = os.path.join(project2_annotations, file)
        with open(file_path, "r") as f:
            lines = f.readlines()
        # Replace the class ID (first number) from 0 to 2
        new_lines = []
        for line in lines:
            parts = line.strip().split()
            if parts[0] == "1":
                parts[0] = "0"
            new_lines.append(" ".join(parts) + "\n")
        with open(file_path, "w") as f:
            f.writelines(new_lines)
