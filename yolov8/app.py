from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import base64
import numpy as np
import re
import csv
import os
import bcrypt

app = Flask(__name__)
CORS(app)

model = YOLO(r"runs\detect\train2\weights\best.pt")
USERS_CSV = "users.csv"

# Ensure CSV exists
if not os.path.exists(USERS_CSV):
    with open(USERS_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["first_name", "last_name", "email", "password"])  # header


def hash_data(data):
    """Hash any data using bcrypt"""
    # Convert data to bytes and hash it
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(data.encode('utf-8'), salt)
    return hashed.decode('utf-8')  # Store as string in CSV


def verify_data(plain_data, hashed_data):
    """Verify plain data against its hash"""
    return bcrypt.checkpw(plain_data.encode('utf-8'), hashed_data.encode('utf-8'))


def save_user_to_csv(first_name, last_name, email, password):
    # Hash ALL fields before saving
    hashed_first_name = hash_data(first_name)
    hashed_last_name = hash_data(last_name)
    hashed_email = hash_data(email)
    hashed_password = hash_data(password)
    
    with open(USERS_CSV, mode="a", newline="") as file:
        writer = csv.writer(file)
        writer.writerow([hashed_first_name, hashed_last_name, hashed_email, hashed_password])


def load_users_from_csv():
    """Load all users from CSV - returns list of user dictionaries with hashed data"""
    users = []
    if os.path.exists(USERS_CSV):
        with open(USERS_CSV, mode="r") as file:
            reader = csv.DictReader(file)
            for row in reader:
                users.append({
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "email": row["email"],
                    "password": row["password"]
                })
    return users


def find_user_by_email(email):
    """Find a user by checking the plain email against all hashed emails"""
    users = load_users_from_csv()
    for user in users:
        if verify_data(email, user["email"]):
            return user
    return None


@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    first_name = data.get("firstName", "").strip()
    last_name = data.get("lastName", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    # Basic validation
    if not all([first_name, last_name, email, password]):
        return jsonify({"success": False, "message": "All fields are required."}), 400

    # Email validation
    email_pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    if not re.match(email_pattern, email):
        return jsonify({"success": False, "message": "Invalid email format."}), 400

    # Password strength validation
    password_pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
    if not re.match(password_pattern, password):
        return jsonify({
            "success": False,
            "message": "Password must be at least 8 characters long, include uppercase, lowercase, and a number."
        }), 400

    # Check if email already exists (must check against all hashed emails)
    if find_user_by_email(email) is not None:
        return jsonify({"success": False, "message": "Email is already registered."}), 400

    save_user_to_csv(first_name, last_name, email, password)
    return jsonify({"success": True, "message": "Registration successful."})


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    # Find user by email
    user = find_user_by_email(email)
    
    if user and verify_data(password, user["password"]):
        return jsonify({"success": True, "message": "Login successful"})
    else:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401


@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    frame_data = data.get('frame').split(',')[1]
    frame_bytes = base64.b64decode(frame_data)
    np_arr = np.frombuffer(frame_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    # Run YOLO prediction
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