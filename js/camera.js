// Camera and MediaPipe initialization
let video;
let faceMesh;
let camera;

async function initMediaPipe() {
	try {
		document.getElementById('cameraStatus').textContent = 'Initializing MediaPipe...';
		document.getElementById('cameraStatus').className = 'camera-status camera-loading';

		// Initialize MediaPipe Face Mesh
		faceMesh = new FaceMesh({
			locateFile: (file) => {
				return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
			}
		});

		faceMesh.setOptions({
			maxNumFaces: 1,
			refineLandmarks: false, // Disable for performance
			minDetectionConfidence: 0.7, // Higher for stability
			minTrackingConfidence: 0.6,
			processEveryNthFrame: 2
		});
		faceMesh.onResults(onResults);

		// Initialize camera
		video = document.getElementById('video');
		camera = new Camera(video, {
			onFrame: async () => {
				await faceMesh.send({image: video});
			},
			width: 480, // Lower resolution for mobile
			height: 320
		});

		await camera.start();
		
		document.getElementById('cameraStatus').textContent = 'Eye-tracking is active';
		document.getElementById('cameraStatus').className = 'camera-status camera-ready';

	} catch (error) {
		console.error('MediaPipe initialization error:', error);
		document.getElementById('cameraStatus').textContent = 'MediaPipe Error - manual mode enabled';
		document.getElementById('cameraStatus').className = 'camera-status camera-error';
		manualMode = true;
		updateManualModeUI();
	}
}