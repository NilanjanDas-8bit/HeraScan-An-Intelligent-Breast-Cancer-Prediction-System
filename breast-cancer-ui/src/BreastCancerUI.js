import { useState, useEffect, useCallback } from "react";
import "./style.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

export default function BreastCancerUI() {
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [patientInfo, setPatientInfo] = useState({
    name: "",
    age: "",
    careOf: "",
    careOfName: "",
    phone: "",
    address: "",
    symptoms: "",
    testValues: {},
  });
  const [predictionResult, setPredictionResult] = useState(null);
  const [chartData, setChartData] = useState(null);

  const apiKey = "AIzaSyCNkiDW5C8lmcHhFikXf8DRYnt9SBrXH30"; // Replace with your API key

  // ✅ Required features list
  const REQUIRED_FEATURES = [
    "radius_mean",
    "texture_mean",
    "perimeter_mean",
    "area_mean",
    "smoothness_mean",
    "compactness_mean",
    "concavity_mean",
    "symmetry_mean",
    "fractal_dimension_mean",
    "radius_se",
  ];

  // ✅ Handle form input changes
  const handleInputChange = (e) => {
    setPatientInfo({ ...patientInfo, [e.target.name]: e.target.value });
  };

  // ✅ Validate form input
  const isPatientInfoValid = () => {
    return (
      patientInfo.name.trim() !== "" &&
      /^[0-9]+$/.test(patientInfo.age) &&
      patientInfo.careOf !== "" &&
      patientInfo.careOfName.trim() !== "" &&
      /^[0-9]{10}$/.test(patientInfo.phone) &&
      patientInfo.address.trim() !== ""
    );
  };

  // ✅ Fetch User's Location
  const getLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ latitude, longitude });
          fetchNearbyCenters(latitude, longitude);
        },
        (error) => console.error("Error fetching location:", error),
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  }, []);

  // ✅ Fetch Nearby Diagnosis Centers
  const fetchNearbyCenters = async (lat, lng) => {
    setLoading(true);
    const radius = 5000; // 5 km radius
    const type = "hospital";
    const proxyUrl = "https://cors-anywhere.herokuapp.com/"; // Replace with your own CORS proxy
    const url = `${proxyUrl}https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.results) {
        setPlaces(data.results);
      } else {
        console.error("No centers found:", data);
      }
    } catch (error) {
      console.error("Error fetching places:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 3) {
      getLocation();
    }
  }, [step, getLocation]);

  // ✅ Handle test value input
  const handleTestValueChange = (e, featureName) => {
    setPatientInfo((prevInfo) => ({
      ...prevInfo,
      testValues: {
        ...prevInfo.testValues,
        [featureName]: e.target.value, // Store values with feature names
      },
    }));
  };
  

  // ✅ Handle prediction request
  const handlePredict = async () => {
    try {
      const testValuesObject = patientInfo.testValues;
  
      // Check for missing features
      const missingFeatures = REQUIRED_FEATURES.filter((feature) => !(feature in testValuesObject));
      if (missingFeatures.length > 0) {
        alert("Missing features: " + missingFeatures.join(", "));
        return;
      }
  
      // Create an object with feature names as keys
      const featuresData = {};
      REQUIRED_FEATURES.forEach((feature) => {
        featuresData[feature] = parseFloat(testValuesObject[feature]);
      });
  
      console.log("Sending test values:", featuresData); // Debug log
  
      // Send correct JSON format
      const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(featuresData), // Send as a dictionary
      });
  
      const data = await response.json();
      console.log("Received response:", data); // Debug log
  
      if (data.prediction !== undefined) {
        setPredictionResult(data.prediction === 1 ? "Malignant" : "Benign"); // ✅ Store prediction
        setChartData(featuresData);            // ✅ Store test values for visualization
        setStep(5); 
      } else {
        alert("Error: " + (data.error || "No prediction received"));
      }
    } catch (error) {
      console.error("Prediction error:", error);
      alert("Error: Unable to get prediction");
    }
  };
  const handleDownloadPDF = async (patientInfo, predictionResult) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Medical Prescription", 80, 10);

    doc.setFontSize(14);
    doc.text("Patient Details:", 15, 25);
    doc.setFontSize(12);
    doc.text(`Name: ${patientInfo.name}`, 15, 35);
    doc.text(`Age: ${patientInfo.age}`, 15, 45);
    doc.text(`Care Of: ${patientInfo.careOf} - ${patientInfo.careOfName}`, 15, 55);
    doc.text(`Phone: ${patientInfo.phone}`, 15, 65);
    doc.text(`Address: ${patientInfo.address}`, 15, 75);

    doc.setFontSize(14);
    doc.text("Symptoms:", 15, 90);
    doc.setFontSize(12);
    doc.text(`${patientInfo.symptoms}`, 15, 100);
    // **Test Parameter Values (Patient Input Table)**
    doc.setFontSize(14);
    doc.text("Test Parameter Values:", 15, 108);

    autoTable(doc, {
      startY: 110,
      head: [["Feature", "Patient's Value"]],
      body: Object.entries(patientInfo.testValues).map(([feature, value]) => [
        feature.replace(/_/g, " ").toUpperCase(),
        parseFloat(value).toFixed(3),
      ]),
    });

    // **Prediction Result**
    let nextY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("Prediction Result:", 15, nextY);
    doc.setFontSize(12);
    doc.text(`The model predicts: ${predictionResult}`, 15, nextY + 10);
    nextY += 25; // Move Y position for next section

    // **Feature Importance Chart**
    doc.setFontSize(14);
    doc.text("Feature Importance:", 15, nextY);
    nextY += 10; // Space before chart

    const chartElement = document.getElementById("feature-importance-chart");

    if (chartElement) {
      try {
        const canvas = await html2canvas(chartElement);
        const imgData = canvas.toDataURL("image/png");

        const imgWidth = 85; // Set width
        const imgHeight = (canvas.height / canvas.width) * imgWidth; // Maintain aspect ratio

        doc.addImage(imgData, "PNG", 15, nextY, imgWidth, imgHeight);
        nextY += imgHeight + 20; // Adjust Y position for next content
      } catch (error) {
        console.error("Error rendering chart:", error);
      }
    } else {
      nextY += 10; // If chart is missing, add spacing to avoid overlap
    }

    if (nextY + 70 > doc.internal.pageSize.height) { 
      doc.addPage();
      nextY = 20; // Reset Y position for new page
  } else {
      nextY += 5; // Add extra space before heading
  }

    // **Mean Values Table**
    // **Mean Values of Features Table**
    doc.setFontSize(14);
    doc.text("Mean Values of Features:", 15, nextY);

    const meanValues = [
      { feature: "radius_mean", benign: 12.1, malignant: 17.5 },
      { feature: "texture_mean", benign: 17.9, malignant: 21.0 },
      { feature: "perimeter_mean", benign: 78.0, malignant: 115.0 },
      { feature: "area_mean", benign: 462.0, malignant: 978.0 },
      { feature: "smoothness_mean", benign: 0.092, malignant: 0.102 },
      { feature: "compactness_mean", benign: 0.085, malignant: 0.145 },
      { feature: "concavity_mean", benign: 0.049, malignant: 0.160 },
      { feature: "symmetry_mean", benign: 0.181, malignant: 0.192 },
      { feature: "fractal_dimension_mean", benign: 0.062, malignant: 0.063 },
      { feature: "radius_se", benign: 0.284, malignant: 0.490 },
    ];

    autoTable(doc, {
      startY: nextY + 10,
      head: [["Feature", "Benign Mean", "Malignant Mean"]],
      body: meanValues.map(row => [
        row.feature.replace(/_/g, " ").toUpperCase(),
        row.benign.toFixed(3),
        row.malignant.toFixed(3),
      ]),
    });
    

    doc.save("Medical_Prescription.pdf");
  };

  

  const meanValues = [
    { feature: "radius_mean", benign: 12.1, malignant: 17.5 },
    { feature: "texture_mean", benign: 17.9, malignant: 21.0 },
    { feature: "perimeter_mean", benign: 78.0, malignant: 115.0 },
    { feature: "area_mean", benign: 462.0, malignant: 978.0 },
    { feature: "smoothness_mean", benign: 0.092, malignant: 0.102 },
    { feature: "compactness_mean", benign: 0.085, malignant: 0.145 },
    { feature: "concavity_mean", benign: 0.049, malignant: 0.160 },
    { feature: "symmetry_mean", benign: 0.181, malignant: 0.192 },
    { feature: "fractal_dimension_mean", benign: 0.062, malignant: 0.063 },
    { feature: "radius_se", benign: 0.284, malignant: 0.490 },
  ];
  

  return (
    <div className="container">
      {/* Step 0: Start Page */}
      {step === 0 && (
        <div className="card">
          <h1>HeraScan -- An Intelligent Breast Cancer Prediction System</h1>
          <p>
          Named after Hera, the Greek goddess of women and health, HeraScan is an advanced breast cancer prediction system designed for early detection. It employs an intelligent approach utilizing a sophisticated Logistic Regression model to provide accurate predictions. Additionally, the system suggests nearby diagnostic centers for further evaluation and generates comprehensive reports based on the prediction results.
          </p>
          <button onClick={() => setStep(1)}>Start</button>
        </div>
      )}

      {/* Step 1: Patient Details */}
      {step === 1 && (
        <div className="card">
          <h2>Enter Patient Details</h2>
          <input name="name" placeholder="Full Name" onChange={handleInputChange} />
          <input name="age" placeholder="Age" maxLength={3} onChange={handleInputChange} />
          <select name="careOf" onChange={handleInputChange}>
            <option value="">Care Of</option>
            <option value="father">Father</option>
            <option value="husband">Husband</option>
          </select>
          <input name="careOfName" placeholder="Care Of Name" onChange={handleInputChange} />
          <input name="phone" placeholder="Phone Number" maxLength={10} onChange={handleInputChange} />
          <textarea name="address" placeholder="Address" onChange={handleInputChange} />
          <button disabled={!isPatientInfoValid()} onClick={() => setStep(2)}>Next</button>
        </div>
      )}

      {/* Step 2: Symptoms */}
      {step === 2 && (
        <div className="card">
          <h2>Enter Symptoms</h2>
          <textarea name="symptoms" placeholder="Describe your symptoms" onChange={handleInputChange} />
          <button disabled={patientInfo.symptoms.trim() === ""} onClick={() => setStep(3)}>Next</button>
        </div>
      )}

      {/* Step 3: Diagnosis Centers */}
      {step === 3 && (
        <div className="card">
          <h2>Recommended Diagnosis Centers & Doctors</h2>
          {location ? (
            <>
              <p>Your Location: 📍 ({location.latitude}, {location.longitude})</p>
              <div id="map"></div>
              <h3>Nearby Diagnosis Centers:</h3>
              {loading ? (
                <p>Fetching nearby centers...</p>
              ) : (
                <ul>
                  {places.map((place, index) => (
                    <li key={index}>
                      <strong>{place.name}</strong> - {place.vicinity}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p>Fetching your location...</p>
          )}
          <button onClick={() => setStep(4)}>Proceed to Test Values</button>
        </div>
      )}

      {/* Step 4: Test Values */}
      {step === 4 && (
        <div className="card">
          <h2>Enter Test Values</h2>
          {REQUIRED_FEATURES.map((feature, index) => (
            <div key={index}>
              <label>{feature.replace(/_/g, " ").toUpperCase()}:</label>
              <input
                type="number"
                placeholder={`Enter ${feature}`}
                onChange={(e) => handleTestValueChange(e, feature)}
              />
            </div>
          ))}
          <button onClick={handlePredict}>Predict</button>
        </div>
      )}

      {/* Step 5: Results and Bar graphs  */}
      {step === 5 && (
        <div className="card">
          <h2>Prediction Result</h2>
          <p>The model predicts: <strong>{predictionResult}</strong></p>

          {/* Graph Visualization */}
          <h3>Feature Importance</h3>
          <BarChart
            width={400}
            height={300}
            data={Object.entries(chartData).map(([key, value]) => ({ feature: key, value }))}>
            <XAxis dataKey="feature" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill={predictionResult === "Malignant" ? "red" : "green"} />
          </BarChart>

          {/* Mean Values Table */}
          <h3>Mean Values of Test Features</h3>
          <table border="1" cellPadding="8" style={{ width: "100%", textAlign: "center", marginTop: "15px" }}>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Benign Mean</th>
                <th>Malignant Mean</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: "radius_mean", benign: 12.1, malignant: 17.5 },
                { feature: "texture_mean", benign: 17.9, malignant: 21.0 },
                { feature: "perimeter_mean", benign: 78.0, malignant: 115.0 },
                { feature: "area_mean", benign: 462.0, malignant: 978.0 },
                { feature: "smoothness_mean", benign: 0.092, malignant: 0.102 },
                { feature: "compactness_mean", benign: 0.085, malignant: 0.145 },
                { feature: "concavity_mean", benign: 0.049, malignant: 0.160 },
                { feature: "symmetry_mean", benign: 0.181, malignant: 0.192 },
                { feature: "fractal_dimension_mean", benign: 0.062, malignant: 0.063 },
                { feature: "radius_se", benign: 0.284, malignant: 0.490 },].map((row, index) => (
                <tr key={index}>
                  <td>{row.feature.replace(/_/g, " ").toUpperCase()}</td>
                  <td>{row.benign.toFixed(3)}</td> 
                  <td>{row.malignant.toFixed(3)}</td> 
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={() => setStep(6)} style={{ marginTop: "15px" }}>Generate Report</button>
        </div>
      )}

      
      {/* Step 6: Prescription Preview */}
      {step === 6 && (
      <div className="card prescription">
      <h2>Prescription Preview</h2>
  
      <div className="patient-details">
          <div className="column">
              <h3>Patient Details</h3>
              <p><strong>Name:</strong> {patientInfo.name}</p>
              <p><strong>Age:</strong> {patientInfo.age}</p>
              <p><strong>Care Of:</strong> {patientInfo.careOf} - {patientInfo.careOfName}</p>
              <p><strong>Phone:</strong> {patientInfo.phone}</p>
              <p><strong>Address:</strong> {patientInfo.address}</p>
          </div>
          
          <div className="column">
              <h3>Symptoms</h3>
              <p>{patientInfo.symptoms}</p>
          </div>
      </div>

        <h3>Test Parameter Values</h3>
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Patient's Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(patientInfo.testValues).map(([feature, value], index) => (
              <tr key={index}>
                <td>{feature.replace(/_/g, " ").toUpperCase()}</td>
                <td>{parseFloat(value).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Prediction Result</h3>
        <p>The model predicts: <strong>{predictionResult}</strong></p>

        <h3>Feature Importance</h3>
       <div id="feature-importance-chart">
        <BarChart width={400} height={300} data={Object.entries(chartData).map(([key, value]) => ({ feature: key, value }))}>
          <XAxis dataKey="feature" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill={predictionResult === "Malignant" ? "red" : "green"} />
        </BarChart></div>

        <h3>Mean Values of Features</h3>
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Benign Mean</th>
              <th>Malignant Mean</th>
            </tr>
          </thead>
          <tbody>
            {meanValues.map((row, index) => (
              <tr key={index}>
                <td>{row.feature.replace(/_/g, " ").toUpperCase()}</td>
                <td>{row.benign.toFixed(3)}</td>
                <td>{row.malignant.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button onClick={() => setStep(0)}>Restart</button>
          <button onClick={() => handleDownloadPDF(patientInfo, predictionResult, chartData)}>
            Download Prescription PDF
          </button>
      </div>
      )}
      
    </div>
  );
}