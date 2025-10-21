from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2, base64, numpy as np, re, csv, os, bcrypt

app = Flask(__name__)
CORS(app)

model = YOLO(r"runs\detect\train2\weights\best.pt")
USERS_CSV = "users.csv"

# Ensure CSV exists
if not os.path.exists(USERS_CSV):
    with open(USERS_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["first_name", "last_name", "email", "password"])  # header

def hash_password(password):
    """Securely hash a password"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Check plain password against hashed one"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def save_user_to_csv(first_name, last_name, email, password):
    """Save user info (only password is hashed)"""
    hashed_password = hash_password(password)
    with open(USERS_CSV, mode="a", newline="") as file:
        writer = csv.writer(file)
        writer.writerow([first_name, last_name, email, hashed_password])

def load_users_from_csv():
    """Load all users from CSV"""
    users = []
    if os.path.exists(USERS_CSV):
        with open(USERS_CSV, mode="r") as file:
            reader = csv.DictReader(file)
            for row in reader:
                users.append(row)
    return users

def find_user_by_email(email):
    """Find user by plain email"""
    users = load_users_from_csv()
    for user in users:
        if user["email"].strip().lower() == email.strip().lower():
            return user
    return None

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    first_name = data.get("firstName", "").strip()
    last_name = data.get("lastName", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    if not all([first_name, last_name, email, password]):
        return jsonify({"success": False, "message": "All fields are required."}), 400

    # Name validation
    name_pattern = r"^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$"

    if not re.match(name_pattern, first_name):
        return jsonify({"success": False, "message": "Invalid first name format."}), 400
    elif not re.match(name_pattern, last_name):
        return jsonify({"success": False, "message": "Invalid last name format."}), 400

    
    # Email validation
    email_pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    if not re.match(email_pattern, email):
        return jsonify({"success": False, "message": "Invalid email format."}), 400

    password_pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
    if not re.match(password_pattern, password):
        return jsonify({
            "success": False,
            "message": "Password must be at least 8 characters long, include uppercase, lowercase, and a number."
        }), 400

    if find_user_by_email(email):
        return jsonify({"success": False, "message": "Email is already registered."}), 400

    save_user_to_csv(first_name, last_name, email, password)
    return jsonify({"success": True, "message": "Registration successful."})

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    user = find_user_by_email(email)
    if user and verify_password(password, user["password"]):
        return jsonify({
            "success": True,
            "message": "Login successful",
            "name": f"{user['first_name']}"
        })
    else:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    frame_data = data.get('frame').split(',')[1]
    frame_bytes = base64.b64decode(frame_data)
    np_arr = np.frombuffer(frame_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    results = model(img)
    detections = results[0].boxes

    if detections is None or len(detections) == 0:
        return jsonify({'disease': "No disease detected", 'confidence': 0})

    top_conf_idx = np.argmax(detections.conf.cpu().numpy())
    disease = model.names[int(detections.cls[top_conf_idx])]
    confidence = float(detections.conf[top_conf_idx]) * 100

    return jsonify({'disease': disease, 'confidence': round(confidence, 2)})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000)
