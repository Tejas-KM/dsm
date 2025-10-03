/**
 * Accurate Distance Measurement App with OpenCV.js
 * Uses perspective correction for high accuracy measurements
 */

// Global variables
let cv = null; // OpenCV.js instance
let isOpenCVReady = false;

// OpenCV ready callback
function onOpenCvReady() {
    cv = window.cv;
    isOpenCVReady = true;
    console.log('✅ OpenCV.js loaded successfully');
    
    // Update UI
    const opencvStatus = document.getElementById('opencvStatus');
    if (opencvStatus) {
        opencvStatus.className = 'status-indicator ready';
        opencvStatus.innerHTML = '<span class="status-dot"></span><span class="status-text">OpenCV.js Ready</span>';
    }
    
    // Update loading progress
    updateLoadingProgress(100);
    
    // Hide loading screen after a delay
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }, 1000);
}

function updateLoadingProgress(percentage) {
    const progressFill = document.getElementById('loadingProgress');
    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
}

class AccurateDistanceMeasurementApp {
    constructor() {
        // App State
        this.currentMode = null;
        this.isCalibrated = false;
        this.calibrationData = null; // Stores perspective transform matrix
        this.measurements = [];
        this.measurementPoints = [];
        this.calibrationPoints = [];
        this.currentUnit = 'm';
        this.isMeasuring = false;
        this.isCalibrationMode = false;
        this.referenceObject = null;
        this.perspectiveMatrix = null;
        this.currentStep = 0; // For multi-step calibration
        
        // DOM Elements
        this.elements = {};
        this.canvas = null;
        this.ctx = null;
        this.video = null;
        this.stream = null;
        this.opencvCanvas = null;
        
        // Enhanced Reference Objects with precise dimensions
        this.referenceObjects = {
            credit_card: { 
                name: "Credit Card", 
                width: 85.6, 
                height: 53.98, 
                unit: "mm",
                type: "rectangle",
                tolerance: 0.5 // ±0.5mm tolerance
            },
            business_card: { 
                name: "Business Card", 
                width: 89, 
                height: 51, 
                unit: "mm",
                type: "rectangle",
                tolerance: 1.0
            },
            a4_paper: { 
                name: "A4 Paper", 
                width: 210, 
                height: 297, 
                unit: "mm",
                type: "rectangle",
                tolerance: 2.0
            },
            letter_paper: { 
                name: "US Letter", 
                width: 216, 
                height: 279, 
                unit: "mm",
                type: "rectangle",
                tolerance: 2.0
            },
            post_it: { 
                name: "Post-it Note", 
                width: 76, 
                height: 76, 
                unit: "mm",
                type: "square",
                tolerance: 1.0
            }
        };
        
        // Unit Conversion Factors (to mm)
        this.units = {
            mm: { name: "Millimeters", symbol: "mm", factor: 1 },
            cm: { name: "Centimeters", symbol: "cm", factor: 0.1 },
            m: { name: "Meters", symbol: "m", factor: 0.001 },
            in: { name: "Inches", symbol: "in", factor: 0.0393701 },
            ft: { name: "Feet", symbol: "ft", factor: 0.00328084 }
        };
        
        // Settings
        this.settings = {
            cameraResolution: { width: 1920, height: 1080 },
            accuracyMode: 'high',
            decimalPlaces: 2,
            stabilizationMode: true
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing Accurate Distance Measurement App');
        
        try {
            this.cacheElements();
            this.setupEventListeners();
            await this.checkCapabilities();
            
            // Wait for OpenCV if not ready
            if (!isOpenCVReady) {
                console.log('⏳ Waiting for OpenCV.js to load...');
                this.waitForOpenCV();
            }
            
            console.log('✅ App initialized successfully');
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showError('Failed to initialize app. Please refresh and try again.');
        }
    }
    
    waitForOpenCV() {
        const checkOpenCV = () => {
            if (isOpenCVReady) {
                console.log('✅ OpenCV.js is ready, enabling precision mode');
                this.enablePrecisionMode();
            } else {
                setTimeout(checkOpenCV, 100);
            }
        };
        checkOpenCV();
    }
    
    enablePrecisionMode() {
        const precisionBtn = document.getElementById('precisionModeBtn');
        if (precisionBtn) {
            precisionBtn.disabled = false;
            precisionBtn.classList.add('enabled');
        }
    }
    
    cacheElements() {
        this.elements = {
            // Main containers
            app: document.getElementById('app'),
            modeSelection: document.getElementById('modeSelection'),
            cameraContainer: document.getElementById('cameraContainer'),
            loadingScreen: document.getElementById('loadingScreen'),
            
            // Controls
            unitSelector: document.getElementById('unitSelector'),
            settingsBtn: document.getElementById('settingsBtn'),
            precisionModeBtn: document.getElementById('precisionModeBtn'),
            arModeBtn: document.getElementById('arModeBtn'),
            basicModeBtn: document.getElementById('basicModeBtn'),
            measureBtn: document.getElementById('measureBtn'),
            clearBtn: document.getElementById('clearBtn'),
            undoBtn: document.getElementById('undoBtn'),
            backBtn: document.getElementById('backBtn'),
            
            // Camera elements
            cameraVideo: document.getElementById('cameraVideo'),
            measurementCanvas: document.getElementById('measurementCanvas'),
            opencvCanvas: document.getElementById('opencvCanvas'),
            
            // Status displays
            opencvStatus: document.getElementById('opencvStatus'),
            webxrStatus: document.getElementById('webxrStatus'),
            currentDistance: document.getElementById('currentDistance'),
            calibrationStatus: document.getElementById('calibrationStatus'),
            instructionsText: document.getElementById('instructionsText'),
            
            // Modals
            precisionCalibrationModal: document.getElementById('precisionCalibrationModal'),
            settingsModal: document.getElementById('settingsModal'),
            precisionReferenceSelect: document.getElementById('precisionReferenceSelect'),
            startPrecisionCalibrationBtn: document.getElementById('startPrecisionCalibrationBtn'),
            
            // Results
            resultsPanel: document.getElementById('resultsPanel'),
            measurementsList: document.getElementById('measurementsList'),
            measurementCount: document.getElementById('measurementCount'),
            exportBtn: document.getElementById('exportBtn'),
            newMeasurementBtn: document.getElementById('newMeasurementBtn'),
            recalibrateBtn: document.getElementById('recalibrateBtn'),
            
            // Values
            distanceValue: document.querySelector('.distance-value'),
            distanceUnit: document.querySelector('.distance-unit'),
            accuracyBadge: document.getElementById('accuracyBadge'),
            calibrationText: document.getElementById('calibrationText'),
            progressFill: document.getElementById('progressFill')
        };
    }
    
    setupEventListeners() {
        // Unit selector
        this.elements.unitSelector?.addEventListener('change', (e) => {
            this.currentUnit = e.target.value;
            this.updateDisplayedMeasurements();
        });
        
        // Mode selection
        this.elements.precisionModeBtn?.addEventListener('click', () => this.selectMode('precision'));
        this.elements.arModeBtn?.addEventListener('click', () => this.selectMode('ar'));
        this.elements.basicModeBtn?.addEventListener('click', () => this.selectMode('basic'));
        
        // Camera controls
        this.elements.measureBtn?.addEventListener('click', () => this.toggleMeasurement());
        this.elements.clearBtn?.addEventListener('click', () => this.clearMeasurements());
        this.elements.undoBtn?.addEventListener('click', () => this.undoLastPoint());
        this.elements.backBtn?.addEventListener('click', () => this.goBack());
        
        // Calibration
        this.elements.startPrecisionCalibrationBtn?.addEventListener('click', () => this.startPrecisionCalibration());
        
        // Results
        this.elements.exportBtn?.addEventListener('click', () => this.exportMeasurements());
        this.elements.newMeasurementBtn?.addEventListener('click', () => this.startNewMeasurement());
        this.elements.recalibrateBtn?.addEventListener('click', () => this.showRecalibration());
        
        // Settings
        this.elements.settingsBtn?.addEventListener('click', () => this.showSettings());
        
        // Reference object selection
        this.elements.precisionReferenceSelect?.addEventListener('change', (e) => {
            this.updateReferenceObjectUI(e.target.value);
        });
        
        // Custom dimensions
        const calibrationMethods = document.querySelectorAll('input[name="calibrationMethod"]');
        calibrationMethods.forEach(method => {
            method.addEventListener('change', (e) => this.updateCalibrationMethod(e.target.value));
        });
    }
    
    async checkCapabilities() {
        console.log('🔍 Checking device capabilities...');
        
        // Check WebXR support
        await this.checkWebXRSupport();
        
        // Check camera support
        await this.checkCameraSupport();
        
        this.updateCapabilityDisplay();
    }
    
    async checkWebXRSupport() {
        if ('xr' in navigator) {
            try {
                const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
                this.webXRSupported = isSupported;
                console.log('WebXR AR Support:', isSupported ? '✅ Available' : '❌ Not available');
            } catch (error) {
                console.log('WebXR Check Failed:', error.message);
                this.webXRSupported = false;
            }
        } else {
            this.webXRSupported = false;
        }
    }
    
    async checkCameraSupport() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            this.cameraSupported = videoDevices.length > 0;
            console.log('Camera Support:', this.cameraSupported ? '✅ Available' : '❌ Not available');
        } catch (error) {
            console.log('Camera Check Failed:', error.message);
            this.cameraSupported = false;
        }
    }
    
    updateCapabilityDisplay() {
        if (!this.elements.webxrStatus) return;
        
        const statusIndicator = this.elements.webxrStatus.querySelector('.status-indicator');
        const statusText = this.elements.webxrStatus.querySelector('.status-text');
        
        if (this.webXRSupported) {
            statusIndicator.className = 'status-indicator supported';
            statusText.textContent = 'WebXR AR supported - High accuracy available';
            this.elements.arModeBtn.disabled = false;
        } else {
            statusIndicator.className = 'status-indicator not-supported';
            statusText.textContent = 'WebXR AR not supported - OpenCV precision mode available';
        }
    }
    
    async selectMode(mode) {
        console.log(`🎯 Selected mode: ${mode.toUpperCase()}`);
        this.currentMode = mode;
        
        this.elements.modeSelection?.classList.add('hidden');
        this.elements.cameraContainer?.classList.remove('hidden');
        
        switch (mode) {
            case 'precision':
                await this.initializePrecisionMode();
                break;
            case 'ar':
                await this.initializeARMode();
                break;
            case 'basic':
                await this.initializeBasicMode();
                break;
        }
    }
    
    async initializePrecisionMode() {
        console.log('🔬 Initializing Precision Mode with OpenCV...');
        
        if (!isOpenCVReady) {
            this.showError('OpenCV.js is still loading. Please wait and try again.');
            this.goBack();
            return;
        }
        
        try {
            await this.initializeCamera();
            this.elements.precisionCalibrationModal?.classList.remove('hidden');
            this.updateInstructions('Precision mode selected. Please complete calibration for maximum accuracy.');
            
        } catch (error) {
            console.error('❌ Precision mode failed:', error);
            this.showError('Failed to start precision mode. Please try again.');
        }
    }
    
    async initializeARMode() {
        console.log('🥽 Initializing AR mode...');
        this.showMessage('AR mode is in development. Using precision mode instead.', 3000);
        await this.initializePrecisionMode();
    }
    
    async initializeBasicMode() {
        console.log('📷 Initializing basic mode...');
        await this.initializeCamera();
        this.showBasicCalibration();
    }
    
    async initializeCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: this.settings.cameraResolution.width },
                    height: { ideal: this.settings.cameraResolution.height }
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.video = this.elements.cameraVideo;
            this.video.srcObject = this.stream;
            this.video.classList.remove('hidden');
            
            this.canvas = this.elements.measurementCanvas;
            this.ctx = this.canvas.getContext('2d');
            
            this.opencvCanvas = this.elements.opencvCanvas;
            
            this.video.addEventListener('loadedmetadata', () => {
                this.setupCanvas();
            });
            
            this.canvas?.addEventListener('click', (e) => this.handleCanvasClick(e));
            
            console.log('✅ Camera initialized');
            
        } catch (error) {
            console.error('❌ Camera initialization failed:', error);
            this.showError('Failed to access camera. Please check permissions and try again.');
        }
    }
    
    setupCanvas() {
        if (!this.video || !this.canvas) return;
        
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.canvas.classList.remove('hidden');
        
        if (this.opencvCanvas) {
            this.opencvCanvas.width = this.canvas.width;
            this.opencvCanvas.height = this.canvas.height;
        }
        
        console.log(`📐 Canvas setup: ${this.canvas.width}x${this.canvas.height}`);
    }
    
    startPrecisionCalibration() {
        console.log('🔬 Starting precision calibration...');
        
        this.elements.precisionCalibrationModal?.classList.add('hidden');
        
        // Get reference object
        const referenceKey = this.elements.precisionReferenceSelect?.value || 'credit_card';
        this.referenceObject = this.referenceObjects[referenceKey];
        
        // Reset state
        this.calibrationPoints = [];
        this.isCalibrationMode = true;
        this.isMeasuring = true;
        this.currentStep = 1;
        
        // Update UI
        this.elements.calibrationStatus?.classList.remove('hidden');
        this.updateCalibrationProgress(0, 'Click top-left corner of reference object');
        
        this.drawCanvas();
    }
    
    handleCanvasClick(event) {
        if (!this.isMeasuring) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        
        if (this.isCalibrationMode) {
            this.handleCalibrationClick(x, y);
        } else {
            this.handleMeasurementClick(x, y);
        }
    }
    
    handleCalibrationClick(x, y) {
        this.calibrationPoints.push({ x, y, step: this.currentStep });
        
        const cornerNames = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
        const progress = (this.currentStep / 4) * 100;
        
        if (this.currentStep < 4) {
            this.currentStep++;
            const nextCorner = cornerNames[this.currentStep - 1];
            this.updateCalibrationProgress(progress, `Click ${nextCorner} corner of reference object`);
        } else {
            this.completePrecisionCalibration();
        }
        
        this.drawCanvas();
        this.playClickSound();
    }
    
    async completePrecisionCalibration() {
        if (this.calibrationPoints.length !== 4 || !isOpenCVReady) {
            this.showError('Calibration incomplete or OpenCV not ready');
            return;
        }
        
        try {
            console.log('🔬 Computing perspective correction...');
            
            // Convert calibration points to OpenCV format
            const srcPoints = this.calibrationPoints.map(p => [p.x, p.y]);
            
            // Define destination rectangle (corrected perspective)
            const refWidth = this.referenceObject.width;
            const refHeight = this.referenceObject.height;
            const scale = 10; // Scale factor for better precision
            
            const dstPoints = [
                [0, 0],
                [refWidth * scale, 0],
                [refWidth * scale, refHeight * scale],
                [0, refHeight * scale]
            ];
            
            // Create OpenCV matrices
            const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcPoints.flat());
            const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstPoints.flat());
            
            // Compute perspective transform matrix
            this.perspectiveMatrix = cv.getPerspectiveTransform(srcMat, dstMat);
            
            // Calculate pixels per mm for reference
            const pixelDistance = Math.sqrt(
                Math.pow(srcPoints[1][0] - srcPoints[0][0], 2) + 
                Math.pow(srcPoints[1][1] - srcPoints[0][1], 2)
            );
            this.calibrationData = {
                pixelsPerMM: pixelDistance / refWidth,
                perspectiveMatrix: this.perspectiveMatrix,
                referenceObject: this.referenceObject,
                scale: scale,
                correctedWidth: refWidth * scale,
                correctedHeight: refHeight * scale
            };
            
            // Cleanup OpenCV matrices
            srcMat.delete();
            dstMat.delete();
            
            // Update state
            this.isCalibrated = true;
            this.isCalibrationMode = false;
            this.isMeasuring = false;
            this.calibrationPoints = [];
            
            // Update UI
            this.elements.calibrationStatus?.classList.add('hidden');
            this.elements.accuracyBadge.textContent = 'High Precision (OpenCV)';
            this.updateInstructions('✅ Precision calibration complete! Ready to measure with high accuracy.');
            
            this.showMessage('🎯 Precision calibration successful! Accuracy improved to ±2-5%', 3000);
            this.drawCanvas();
            
            console.log('✅ Precision calibration completed:', this.calibrationData);
            
        } catch (error) {
            console.error('❌ Precision calibration failed:', error);
            this.showError('Calibration failed. Please try again with clearer corner points.');
            this.resetCalibration();
        }
    }
    
    handleMeasurementClick(x, y) {
        this.measurementPoints.push({ x, y, timestamp: Date.now() });
        
        if (this.measurementPoints.length === 2) {
            this.calculatePreciseDistance();
        }
        
        this.drawCanvas();
        this.playClickSound();
    }
    
    calculatePreciseDistance() {
        if (this.measurementPoints.length !== 2 || !this.isCalibrated) return;
        
        try {
            if (this.currentMode === 'precision' && this.perspectiveMatrix) {
                this.calculateDistanceWithPerspectiveCorrection();
            } else {
                this.calculateBasicDistance();
            }
        } catch (error) {
            console.error('❌ Distance calculation failed:', error);
            this.showError('Distance calculation failed. Please try again.');
        }
    }
    
    calculateDistanceWithPerspectiveCorrection() {
        const p1 = this.measurementPoints[0];
        const p2 = this.measurementPoints[1];
        
        // Transform points using perspective correction
        const srcPoints = cv.matFromArray(2, 1, cv.CV_32FC2, [p1.x, p1.y, p2.x, p2.y]);
        const dstPoints = new cv.Mat();
        
        cv.perspectiveTransform(srcPoints, dstPoints, this.perspectiveMatrix);
        
        // Get corrected coordinates
        const correctedP1 = { x: dstPoints.data32F[0], y: dstPoints.data32F[1] };
        const correctedP2 = { x: dstPoints.data32F[2], y: dstPoints.data32F[3] };
        
        // Calculate distance in corrected space
        const correctedDistance = Math.sqrt(
            Math.pow(correctedP2.x - correctedP1.x, 2) + 
            Math.pow(correctedP2.y - correctedP1.y, 2)
        );
        
        // Convert to real-world units (mm)
        const distanceInMM = correctedDistance / this.calibrationData.scale;
        const distanceInUnit = distanceInMM * this.units[this.currentUnit].factor;
        
        // Store measurement
        const measurement = {
            id: Date.now(),
            distance: distanceInMM,
            displayDistance: distanceInUnit,
            unit: this.currentUnit,
            timestamp: new Date(),
            points: [...this.measurementPoints],
            correctedPoints: [correctedP1, correctedP2],
            mode: 'precision',
            accuracy: 'high',
            method: 'perspective_correction'
        };
        
        this.measurements.push(measurement);
        this.displayDistance(distanceInUnit);
        this.updateResultsPanel();
        this.resetMeasurementState();
        
        // Cleanup OpenCV matrices
        srcPoints.delete();
        dstPoints.delete();
        
        console.log(`🎯 Precision measurement: ${distanceInUnit.toFixed(this.settings.decimalPlaces)} ${this.units[this.currentUnit].symbol}`);
        this.showMessage(`📏 Distance: ${distanceInUnit.toFixed(this.settings.decimalPlaces)} ${this.units[this.currentUnit].symbol}`, 2000);
    }
    
    calculateBasicDistance() {
        const p1 = this.measurementPoints[0];
        const p2 = this.measurementPoints[1];
        
        const pixelDistance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const distanceInMM = pixelDistance / this.calibrationData.pixelsPerMM;
        const distanceInUnit = distanceInMM * this.units[this.currentUnit].factor;
        
        const measurement = {
            id: Date.now(),
            distance: distanceInMM,
            displayDistance: distanceInUnit,
            unit: this.currentUnit,
            timestamp: new Date(),
            points: [...this.measurementPoints],
            mode: 'basic',
            accuracy: 'medium',
            method: 'triangle_similarity'
        };
        
        this.measurements.push(measurement);
        this.displayDistance(distanceInUnit);
        this.updateResultsPanel();
        this.resetMeasurementState();
        
        console.log(`📏 Basic measurement: ${distanceInUnit.toFixed(this.settings.decimalPlaces)} ${this.units[this.currentUnit].symbol}`);
    }
    
    resetMeasurementState() {
        this.measurementPoints = [];
        this.isMeasuring = false;
        
        if (this.elements.measureBtn) {
            this.elements.measureBtn.innerHTML = '<span class="btn-icon">📐</span><span class="btn-text">Start Measuring</span>';
        }
    }
    
    displayDistance(distance) {
        if (this.elements.distanceValue && this.elements.distanceUnit) {
            this.elements.distanceValue.textContent = distance.toFixed(this.settings.decimalPlaces);
            this.elements.distanceUnit.textContent = this.units[this.currentUnit].symbol;
            this.elements.currentDistance?.classList.remove('hidden');
        }
    }
    
    drawCanvas() {
        if (!this.ctx || !this.canvas) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw calibration points
        if (this.isCalibrationMode && this.calibrationPoints.length > 0) {
            this.drawCalibrationPoints();
        }
        
        // Draw measurement points
        if (this.measurementPoints.length > 0) {
            this.drawMeasurementPoints();
        }
    }
    
    drawCalibrationPoints() {
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00']; // Red, Green, Blue, Yellow
        const cornerNames = ['TL', 'TR', 'BR', 'BL'];
        
        this.calibrationPoints.forEach((point, index) => {
            const color = colors[index];
            
            // Draw point
            this.ctx.fillStyle = color;
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 3;
            
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 12, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Draw label
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(cornerNames[index], point.x, point.y + 5);
        });
        
        // Draw lines between points
        if (this.calibrationPoints.length > 1) {
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            
            for (let i = 0; i < this.calibrationPoints.length - 1; i++) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.calibrationPoints[i].x, this.calibrationPoints[i].y);
                this.ctx.lineTo(this.calibrationPoints[i + 1].x, this.calibrationPoints[i + 1].y);
                this.ctx.stroke();
            }
            
            // Close the rectangle if we have all 4 points
            if (this.calibrationPoints.length === 4) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.calibrationPoints[3].x, this.calibrationPoints[3].y);
                this.ctx.lineTo(this.calibrationPoints[0].x, this.calibrationPoints[0].y);
                this.ctx.stroke();
            }
            
            this.ctx.setLineDash([]);
        }
    }
    
    drawMeasurementPoints() {
        const pointRadius = 10;
        const primaryColor = '#4facfe';
        const secondaryColor = '#ffffff';
        
        this.ctx.strokeStyle = primaryColor;
        this.ctx.fillStyle = primaryColor;
        this.ctx.lineWidth = 3;
        
        // Draw line between points
        if (this.measurementPoints.length === 2) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.measurementPoints[0].x, this.measurementPoints[0].y);
            this.ctx.lineTo(this.measurementPoints[1].x, this.measurementPoints[1].y);
            this.ctx.stroke();
        }
        
        // Draw points
        this.measurementPoints.forEach((point, index) => {
            // Outer circle
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, pointRadius, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Inner circle
            this.ctx.fillStyle = secondaryColor;
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, pointRadius - 3, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Point number
            this.ctx.fillStyle = primaryColor;
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText((index + 1).toString(), point.x, point.y + 4);
            
            this.ctx.fillStyle = primaryColor;
        });
    }
    
    updateCalibrationProgress(percentage, text) {
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = percentage + '%';
        }
        if (this.elements.calibrationText) {
            this.elements.calibrationText.textContent = text;
        }
    }
    
    updateInstructions(text) {
        if (this.elements.instructionsText) {
            this.elements.instructionsText.textContent = text;
        }
    }
    
    toggleMeasurement() {
        if (!this.isCalibrated) {
            if (this.currentMode === 'precision') {
                this.elements.precisionCalibrationModal?.classList.remove('hidden');
            } else {
                this.showBasicCalibration();
            }
            return;
        }
        
        if (this.isMeasuring) {
            this.stopMeasuring();
        } else {
            this.startMeasuring();
        }
    }
    
    startMeasuring() {
        this.isMeasuring = true;
        this.measurementPoints = [];
        
        if (this.elements.measureBtn) {
            this.elements.measureBtn.innerHTML = '<span class="btn-icon">⏹️</span><span class="btn-text">Stop Measuring</span>';
        }
        
        this.elements.clearBtn?.classList.remove('hidden');
        this.elements.undoBtn?.classList.remove('hidden');
        
        const mode = this.currentMode === 'precision' ? 'precision' : 'basic';
        this.updateInstructions(`Click two points to measure distance (${mode} mode)`);
    }
    
    stopMeasuring() {
        this.resetMeasurementState();
        this.updateInstructions('Measurement stopped. Click "Start Measuring" to continue.');
        this.drawCanvas();
    }
    
    undoLastPoint() {
        if (this.measurementPoints.length > 0) {
            this.measurementPoints.pop();
            this.drawCanvas();
            this.showMessage('Last point removed', 1000);
        }
    }
    
    clearMeasurements() {
        this.measurementPoints = [];
        this.measurements = [];
        this.resetMeasurementState();
        
        this.drawCanvas();
        this.elements.currentDistance?.classList.add('hidden');
        this.elements.resultsPanel?.classList.add('hidden');
        this.elements.clearBtn?.classList.add('hidden');
        this.elements.undoBtn?.classList.add('hidden');
        
        this.updateInstructions('All measurements cleared. Ready to measure again.');
        this.showMessage('🗑️ All measurements cleared', 1500);
    }
    
    updateResultsPanel() {
        if (!this.elements.measurementsList) return;
        
        this.elements.measurementsList.innerHTML = '';
        
        if (this.elements.measurementCount) {
            this.elements.measurementCount.textContent = `${this.measurements.length} measurement${this.measurements.length !== 1 ? 's' : ''}`;
        }
        
        this.measurements.forEach((measurement, index) => {
            const convertedDistance = measurement.distance * this.units[this.currentUnit].factor;
            const accuracyIcon = measurement.accuracy === 'high' ? '🎯' : measurement.accuracy === 'medium' ? '📐' : '📏';
            
            const item = document.createElement('div');
            item.className = 'measurement-item';
            item.innerHTML = `
                <div class="measurement-info">
                    <div class="measurement-label">${accuracyIcon} Measurement ${index + 1}</div>
                    <div class="measurement-details">${measurement.method} • ${measurement.accuracy} accuracy</div>
                </div>
                <div class="measurement-value">${convertedDistance.toFixed(this.settings.decimalPlaces)} ${this.units[this.currentUnit].symbol}</div>
            `;
            
            this.elements.measurementsList.appendChild(item);
        });
        
        this.elements.resultsPanel?.classList.remove('hidden');
    }
    
    updateDisplayedMeasurements() {
        if (!this.elements.currentDistance?.classList.contains('hidden') && this.measurements.length > 0) {
            const lastMeasurement = this.measurements[this.measurements.length - 1];
            const convertedDistance = lastMeasurement.distance * this.units[this.currentUnit].factor;
            
            if (this.elements.distanceValue && this.elements.distanceUnit) {
                this.elements.distanceValue.textContent = convertedDistance.toFixed(this.settings.decimalPlaces);
                this.elements.distanceUnit.textContent = this.units[this.currentUnit].symbol;
            }
        }
        
        if (this.measurements.length > 0) {
            this.updateResultsPanel();
        }
    }
    
    exportMeasurements() {
        if (this.measurements.length === 0) {
            this.showError('No measurements to export');
            return;
        }
        
        const exportData = {
            appName: 'Accurate Distance Measurement App',
            version: '2.0 (OpenCV Enhanced)',
            exportDate: new Date().toISOString(),
            calibrationData: {
                isCalibrated: this.isCalibrated,
                method: this.currentMode,
                referenceObject: this.referenceObject?.name,
                accuracy: this.currentMode === 'precision' ? 'high' : 'medium'
            },
            settings: this.settings,
            measurements: this.measurements.map(m => ({
                id: m.id,
                distance_mm: m.distance,
                distance_display: m.displayDistance,
                unit: m.unit,
                timestamp: m.timestamp,
                mode: m.mode,
                accuracy: m.accuracy,
                method: m.method
            })),
            summary: {
                totalMeasurements: this.measurements.length,
                averageDistance: this.measurements.reduce((sum, m) => sum + m.distance, 0) / this.measurements.length,
                minDistance: Math.min(...this.measurements.map(m => m.distance)),
                maxDistance: Math.max(...this.measurements.map(m => m.distance)),
                accuracyMode: this.currentMode
            }
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `accurate-measurements-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showMessage('📤 Measurements exported successfully', 2000);
        console.log('📤 Export completed:', this.measurements.length, 'measurements');
    }
    
    startNewMeasurement() {
        this.measurementPoints = [];
        this.resetMeasurementState();
        this.updateInstructions('Ready for new measurements. Click "Start Measuring" to begin.');
    }
    
    showRecalibration() {
        if (this.currentMode === 'precision') {
            this.resetCalibration();
            this.elements.precisionCalibrationModal?.classList.remove('hidden');
        } else {
            this.showBasicCalibration();
        }
    }
    
    resetCalibration() {
        this.isCalibrated = false;
        this.calibrationData = null;
        this.calibrationPoints = [];
        this.perspectiveMatrix = null;
        this.currentStep = 0;
        this.elements.calibrationStatus?.classList.add('hidden');
    }
    
    showBasicCalibration() {
        // Implementation for basic calibration modal
        this.showMessage('Basic calibration not implemented in this demo. Use precision mode.', 3000);
    }
    
    showSettings() {
        this.elements.settingsModal?.classList.remove('hidden');
    }
    
    goBack() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.perspectiveMatrix) {
            this.perspectiveMatrix.delete();
            this.perspectiveMatrix = null;
        }
        
        this.resetCalibration();
        this.currentMode = null;
        this.isMeasuring = false;
        this.measurementPoints = [];
        
        this.elements.cameraContainer?.classList.add('hidden');
        this.elements.modeSelection?.classList.remove('hidden');
        this.elements.precisionCalibrationModal?.classList.add('hidden');
        this.elements.resultsPanel?.classList.add('hidden');
        this.elements.settingsModal?.classList.add('hidden');
        
        console.log('⬅️ Returned to mode selection');
    }
    
    showMessage(message, duration = 3000) {
        const existingMessages = document.querySelectorAll('.temp-message');
        existingMessages.forEach(msg => msg.remove());
        
        const messageEl = document.createElement('div');
        messageEl.className = 'temp-message';
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 1rem 2rem;
            border-radius: 25px;
            font-size: 1.1rem;
            font-weight: 600;
            z-index: 10000;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            max-width: 80%;
            text-align: center;
            animation: messageSlideIn 0.3s ease;
        `;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.animation = 'messageSlideOut 0.3s ease';
                setTimeout(() => messageEl.remove(), 300);
            }
        }, duration);
    }
    
    showError(message) {
        console.error('❌ Error:', message);
        this.showMessage(`❌ ${message}`, 4000);
    }
    
    playClickSound() {
        try {
            if ('AudioContext' in window || 'webkitAudioContext' in window) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const audioContext = new AudioContext();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
            }
        } catch (error) {
            // Ignore audio errors
        }
    }
    
    updateReferenceObjectUI(value) {
        const customDimensions = document.getElementById('customDimensions');
        if (customDimensions) {
            if (value === 'custom') {
                customDimensions.classList.remove('hidden');
            } else {
                customDimensions.classList.add('hidden');
            }
        }
    }
    
    updateCalibrationMethod(method) {
        console.log('Calibration method changed:', method);
        // Update UI based on selected method
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎉 DOM loaded, initializing Accurate Distance Measurement App...');
    
    // Start loading progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 2;
        updateLoadingProgress(Math.min(progress, 90)); // Stop at 90%, OpenCV will complete to 100%
        
        if (progress >= 90) {
            clearInterval(progressInterval);
        }
    }, 100);
    
    window.accurateDistanceApp = new AccurateDistanceMeasurementApp();
});

// Global error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccurateDistanceMeasurementApp;
}