import os

labels_folder = r"C:\Users\Edrian\Documents\VSCodeProjects\CaniScan\dataset\Mange\train\labels"

for filename in os.listdir(labels_folder):
    if filename.endswith(".txt"):
        file_path = os.path.join(labels_folder, filename)
        
        with open(file_path, "r") as f:
            lines = f.readlines()
        
        new_lines = []
        for line in lines:
            parts = line.strip().split()
            if parts:
                if parts[0] == "0":   # if it's demodicosis
                    parts[0] = "1"    # change to mange
                new_lines.append(" ".join(parts) + "\n")
        
        with open(file_path, "w") as f:
            f.writelines(new_lines)

print("✅ All class IDs '0' changed to '1' (mange).")
