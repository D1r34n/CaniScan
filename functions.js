fetch('fci-breeds.csv')
  .then(response => response.text())
  .then(data => {
    const lines = data.split('\n').slice(1);
    const select = document.getElementById('dogBreed');
    lines.forEach(line => {
      if(line.trim() !== "") {
        const columns = line.split(',');
        const breedName = columns[1].trim();
        const option = document.createElement('option');
        option.textContent = breedName;
        option.value = breedName;
        select.appendChild(option);
      }
    });
  })
.catch(err => console.error('Error loading CSV:', err));

const connectBtn = document.getElementById('connectPhoneButton');
const disconnectBtn = document.getElementById('disconnectPhoneButton');
const video = document.getElementById('phoneVideo');
const placeholder = document.querySelector('.connectPhoneNote');
const analyzeBtn = document.getElementById('analyzeButton');
const dogBreedSelect = document.getElementById('dogBreed');
const navbar = document.getElementById('navigationBar');
const navbarTitle = document.getElementById('navbarTitle');
const navbarSubtitle = document.getElementById('navbarSubtitle');

// Page elements
const capturePage = document.getElementById('capturePage');
const analysisPage = document.getElementById('analysisPage');
const analysisVideo = document.getElementById('analysisVideo');

let stream = null;
let connected = false;

connectBtn.addEventListener('click', async () => {
    if (!connected) {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = stream;
            await video.play();

            video.style.display = "block";
            placeholder.style.display = 'none';

            connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Disconnect Phone Camera';
            connectBtn.classList.remove('btn-primary');
            connectBtn.classList.add('btn-danger');

            connected = true;
            analyzeBtn.disabled = !(connected && dogBreedSelect.value !== "Select Dog Breed");

        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Could not access the camera.");
        }
    } else {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }

        video.style.display = "none";
        placeholder.style.display = 'block';

        connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect Phone';
        connectBtn.classList.remove('btn-danger');
        connectBtn.classList.add('btn-primary');

        connected = false;
        analyzeBtn.disabled = true;
    }
});

dogBreedSelect.addEventListener('change', () => {
    analyzeBtn.disabled = !(connected && dogBreedSelect.value !== "Select Dog Breed");
});

disconnectBtn.addEventListener('click', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }

    // Change navbar
    navbar.style.backgroundColor = "#004aad";
    navbarTitle.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Dog Skin Disease Analyzer';
    navbarSubtitle.textContent = "Upload a photo and provide details for diagnosis";

    // Hide capture page, show analysis page
    capturePage.style.display = "flex";
    analysisPage.style.display = "none";

    // Disconnect video
    video.style.display = "none";
    placeholder.style.display = 'block';

    // Reset phone button
    connectBtn.innerHTML = '<i class="bi bi-phone-fill me-2"></i>Connect Phone';
    connectBtn.classList.remove('btn-danger');
    connectBtn.classList.add('btn-primary');

    // Reset dog select breed
    dogBreedSelect.value = "Select Dog Breed";
    
    connected = false;
    analyzeBtn.disabled = true;
    analyzing = false;
});

dogBreedSelect.addEventListener('change', () => {
    analyzeBtn.disabled = !(connected && dogBreedSelect.value !== "Select Dog Breed");
});

analyzing = false;
// ✅ ANALYZE BUTTON - SWITCHES TO ANALYSIS PAGE
// analyzeBtn.addEventListener('click', () => {
//     // Change navbar
//     navbar.style.backgroundColor = "#00bf63";
//     navbarTitle.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>AI Analysis Results';
//     navbarSubtitle.textContent = "";

//     // Hide capture page, show analysis page
//     capturePage.style.display = "none";
//     analysisPage.style.display = "flex";

//     // Transfer video stream to analysis page
//     if (stream) {
//         analysisVideo.srcObject = stream;
//         analysisVideo.play();
//         analysisVideo.style.display = "block";
//     }
// });

//PYTHON WITH FLASK

analyzeBtn.addEventListener('click', async () => {
  if (analyzing) return; // prevent overlap
  analyzing = true;

  // 1️⃣ Switch UI only the first time
  if (capturePage.style.display !== "none") {
    navbar.style.backgroundColor = "#00bf63";
    navbarTitle.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>AI Analysis Results';
    navbarSubtitle.textContent = "";

    capturePage.style.display = "none";
    analysisPage.style.display = "flex";

    if (stream) {
      analysisVideo.srcObject = stream;
      analysisVideo.play();
      analysisVideo.style.display = "block";
    }
  }

  // 2️⃣ Capture frame from live video
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const frameData = canvas.toDataURL('image/jpeg');

  try {
    // 3️⃣ Send frame to Flask
    const response = await fetch('http://127.0.0.1:5000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame: frameData, breed: dogBreedSelect.value })
    });

    if (!response.ok) throw new Error('Server error');
    const result = await response.json();

    const diseaseName = document.querySelector('.diagnosis-disease');
    const confidenceBadge = document.querySelector('.confidence-badge');
    const recommendationsBox = document.querySelector('.recommendations-box');

    diseaseName.textContent = result.disease || "No detection";
    confidenceBadge.textContent = result.confidence ? `${result.confidence}%` : "—";

    if (result.disease === "No disease detected" || result.confidence === 0) {
      recommendationsBox.textContent =
        "✅ No visible signs of disease detected. Try capturing another angle or better lighting.";
    } else if (result.confidence > 80) {
      recommendationsBox.textContent =
        `⚠️ High confidence: ${result.disease}. Please consult a veterinarian.`;
    } else if (result.confidence > 50) {
      recommendationsBox.textContent =
        `🔍 Possible ${result.disease}. Capture a clearer image to confirm.`;
    } else {
      recommendationsBox.textContent =
        "🟢 Low confidence detection. Possibly normal skin condition.";
    }

  } catch (err) {
    console.error('Error during analysis:', err);
  }

  analyzing = false;
});

setInterval(() => {
  if (connected && !analyzing && analysisPage.style.display === "flex") {
    analyzeBtn.click();
  }
}, 1000); // analyze every 5 seconds
