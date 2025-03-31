from flask import Flask, request, jsonify # type: ignore
from flask_cors import CORS # type: ignore
import pickle
import numpy as np

app = Flask(__name__)
CORS(app)

# Load the trained model and scaler
with open("model.pkl", "rb") as file:
    model = pickle.load(file)

with open("scaler.pkl", "rb") as file:  # Load the scaler
    scaler = pickle.load(file)

# Define the 10 required features
REQUIRED_FEATURES = [
    "radius_mean", "texture_mean", "perimeter_mean", "area_mean", "smoothness_mean",
    "compactness_mean", "concavity_mean", "symmetry_mean", "fractal_dimension_mean", "radius_se"
]

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        print("Received Data:", data)  # Debugging log

        # Ensure data contains all required features
        if not all(feature in data for feature in REQUIRED_FEATURES):
            missing_features = [feature for feature in REQUIRED_FEATURES if feature not in data]
            return jsonify({"error": f"Missing features: {missing_features}"}), 400

        # Extract features in the correct order
        features = np.array([data[feature] for feature in REQUIRED_FEATURES]).reshape(1, -1)

        # Apply scaling using the same scaler used in training
        scaled_features = scaler.transform(features)

        # Get prediction from model
        prediction = model.predict(scaled_features)[0]
        print("Prediction Result:", prediction)  # Debugging log

        return jsonify({"prediction": int(prediction)})  # Ensure response is always a integer
    

    except Exception as e:
        print("Error:", str(e))  # Print error in console
        return jsonify({"error": str(e)}), 500  # Return error message

if __name__ == "__main__":
    app.run(debug=True)
