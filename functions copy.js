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

            connectBtn.innerHTML = '<i class="bi bi-phone-slash-fill me-2"></i>Disconnect Phone Camera';
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

// ✅ ANALYZE BUTTON - SWITCHES TO ANALYSIS PAGE
analyzeBtn.addEventListener('click', () => {
    // Change navbar
    navbar.style.backgroundColor = "#00bf63";
    navbarTitle.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>AI Analysis Results';
    navbarSubtitle.textContent = "";

    // Hide capture page, show analysis page
    capturePage.style.display = "none";
    analysisPage.style.display = "flex";

    // Transfer video stream to analysis page
    if (stream) {
        analysisVideo.srcObject = stream;
        analysisVideo.play();
        analysisVideo.style.display = "block";
    }
});