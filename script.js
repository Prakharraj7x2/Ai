
// Animation code
window.addEventListener("load", windowLoadHandler, false);
var sphereRad = 140;
var radius_sp = 1;

function windowLoadHandler() {
  try {
    canvasApp();
  } catch (error) {
    console.log("Canvas application error: " + error);
  }
}

function canvasSupport() {
  var canvas = document.getElementById("canvasOne");
  return canvas && canvas.getContext;
}

function canvasApp() {
  if (!canvasSupport()) {
    return;
  }

  var theCanvas = document.getElementById("canvasOne");
  if (!theCanvas) return;
  
  var context = theCanvas.getContext("2d");
  if (!context) return;

  var displayWidth;
  var displayHeight;
  var timer;
  var wait;
  var count;
  var numToAddEachFrame;
  var particleList;
  var recycleBin;
  var particleAlpha;
  var r, g, b;
  var fLen;
  var m;
  var projCenterX;
  var projCenterY;
  var zMax;
  var turnAngle;
  var turnSpeed;
  var sphereCenterX, sphereCenterY, sphereCenterZ;
  var particleRad;
  var zeroAlphaDepth;
  var randAccelX, randAccelY, randAccelZ;
  var gravity;
  var rgbString;
  //we are defining a lot of variables used in the screen update functions globally so that they don't have to be redefined every frame.
  var p;
  var outsideTest;
  var nextParticle;
  var sinAngle;
  var cosAngle;
  var rotX, rotZ;
  var depthAlphaFactor;
  var i;
  var theta, phi;
  var x0, y0, z0;

  init();

  function init() {
    wait = 1;
    count = wait - 1;
    numToAddEachFrame = 8;

    //particle color
    r = 0;
    g = 72;
    b = 255;

    rgbString = "rgba(" + r + "," + g + "," + b + ","; //partial string for color which will be completed by appending alpha value.
    particleAlpha = 1; //maximum alpha

    displayWidth = theCanvas.width;
    displayHeight = theCanvas.height;

    fLen = 320; //represents the distance from the viewer to z=0 depth.

    //projection center coordinates sets location of origin
    projCenterX = displayWidth / 2;
    projCenterY = displayHeight / 2;

    //we will not draw coordinates if they have too large of a z-coordinate (which means they are very close to the observer).
    zMax = fLen - 2;

    particleList = {};
    recycleBin = {};

    //random acceleration factors - causes some random motion
    randAccelX = 0.1;
    randAccelY = 0.1;
    randAccelZ = 0.1;

    gravity = -0; //try changing to a positive number (not too large, for example 0.3), or negative for floating upwards.

    particleRad = 1.8;

    sphereCenterX = 0;
    sphereCenterY = 0;
    sphereCenterZ = -3 - sphereRad;

    //alpha values will lessen as particles move further back, causing depth-based darkening:
    zeroAlphaDepth = -750;

    turnSpeed = 2 * Math.PI / 1200; //the sphere will rotate at this speed (one complete rotation every 1600 frames).
    turnAngle = 0; //initial angle

    timer = setInterval(onTimer, 10 / 24);
  }

  function onTimer() {
    //if enough time has elapsed, we will add new particles.		
    count++;
    if (count >= wait) {

      count = 0;
      for (i = 0; i < numToAddEachFrame; i++) {
        theta = Math.random() * 2 * Math.PI;
        phi = Math.acos(Math.random() * 2 - 1);
        x0 = sphereRad * Math.sin(phi) * Math.cos(theta);
        y0 = sphereRad * Math.sin(phi) * Math.sin(theta);
        z0 = sphereRad * Math.cos(phi);

        //We use the addParticle function to add a new particle. The parameters set the position and velocity components.
        //Note that the velocity parameters will cause the particle to initially fly outwards away from the sphere center (after
        //it becomes unstuck).
        var p = addParticle(x0, sphereCenterY + y0, sphereCenterZ + z0, 0.002 * x0, 0.002 * y0, 0.002 * z0);

        //we set some "envelope" parameters which will control the evolving alpha of the particles.
        p.attack = 50;
        p.hold = 50;
        p.decay = 100;
        p.initValue = 0;
        p.holdValue = particleAlpha;
        p.lastValue = 0;

        //the particle will be stuck in one place until this time has elapsed:
        p.stuckTime = 90 + Math.random() * 20;

        p.accelX = 0;
        p.accelY = gravity;
        p.accelZ = 0;
      }
    }

    //update viewing angle
    turnAngle = (turnAngle + turnSpeed) % (2 * Math.PI);
    sinAngle = Math.sin(turnAngle);
    cosAngle = Math.cos(turnAngle);

    //background fill
    context.fillStyle = "#000000";
    context.fillRect(0, 0, displayWidth, displayHeight);

    //update and draw particles
    p = particleList.first;
    while (p != null) {
      //before list is altered record next particle
      nextParticle = p.next;

      //update age
      p.age++;

      //if the particle is past its "stuck" time, it will begin to move.
      if (p.age > p.stuckTime) {
        p.velX += p.accelX + randAccelX * (Math.random() * 2 - 1);
        p.velY += p.accelY + randAccelY * (Math.random() * 2 - 1);
        p.velZ += p.accelZ + randAccelZ * (Math.random() * 2 - 1);

        p.x += p.velX;
        p.y += p.velY;
        p.z += p.velZ;
      }

      /*
      We are doing two things here to calculate display coordinates.
      The whole display is being rotated around a vertical axis, so we first calculate rotated coordinates for
      x and z (but the y coordinate will not change).
      Then, we take the new coordinates (rotX, y, rotZ), and project these onto the 2D view plane.
      */
      rotX = cosAngle * p.x + sinAngle * (p.z - sphereCenterZ);
      rotZ = -sinAngle * p.x + cosAngle * (p.z - sphereCenterZ) + sphereCenterZ;
      m = radius_sp * fLen / (fLen - rotZ);
      p.projX = rotX * m + projCenterX;
      p.projY = p.y * m + projCenterY;

      //update alpha according to envelope parameters.
      if (p.age < p.attack + p.hold + p.decay) {
        if (p.age < p.attack) {
          p.alpha = (p.holdValue - p.initValue) / p.attack * p.age + p.initValue;
        }
        else if (p.age < p.attack + p.hold) {
          p.alpha = p.holdValue;
        }
        else if (p.age < p.attack + p.hold + p.decay) {
          p.alpha = (p.lastValue - p.holdValue) / p.decay * (p.age - p.attack - p.hold) + p.holdValue;
        }
      }
      else {
        p.dead = true;
      }

      //see if the particle is still within the viewable range.
      if ((p.projX > displayWidth) || (p.projX < 0) || (p.projY < 0) || (p.projY > displayHeight) || (rotZ > zMax)) {
        outsideTest = true;
      }
      else {
        outsideTest = false;
      }

      if (outsideTest || p.dead) {
        recycle(p);
      }

      else {
        //depth-dependent darkening
        depthAlphaFactor = (1 - rotZ / zeroAlphaDepth);
        depthAlphaFactor = (depthAlphaFactor > 1) ? 1 : ((depthAlphaFactor < 0) ? 0 : depthAlphaFactor);
        context.fillStyle = rgbString + depthAlphaFactor * p.alpha + ")";

        //draw
        context.beginPath();
        context.arc(p.projX, p.projY, m * particleRad, 0, 2 * Math.PI, false);
        context.closePath();
        context.fill();
      }

      p = nextParticle;
    }
  }

  function addParticle(x0, y0, z0, vx0, vy0, vz0) {
    var newParticle;
    var color;

    //check recycle bin for available drop:
    if (recycleBin.first != null) {
      newParticle = recycleBin.first;
      //remove from bin
      if (newParticle.next != null) {
        recycleBin.first = newParticle.next;
        newParticle.next.prev = null;
      }
      else {
        recycleBin.first = null;
      }
    }
    //if the recycle bin is empty, create a new particle (a new ampty object):
    else {
      newParticle = {};
    }

    //add to beginning of particle list
    if (particleList.first == null) {
      particleList.first = newParticle;
      newParticle.prev = null;
      newParticle.next = null;
    }
    else {
      newParticle.next = particleList.first;
      particleList.first.prev = newParticle;
      particleList.first = newParticle;
      newParticle.prev = null;
    }

    //initialize
    newParticle.x = x0;
    newParticle.y = y0;
    newParticle.z = z0;
    newParticle.velX = vx0;
    newParticle.velY = vy0;
    newParticle.velZ = vz0;
    newParticle.age = 0;
    newParticle.dead = false;
    if (Math.random() < 0.5) {
      newParticle.right = true;
    }
    else {
      newParticle.right = false;
    }
    return newParticle;
  }

  function recycle(p) {
    //remove from particleList
    if (particleList.first == p) {
      if (p.next != null) {
        p.next.prev = null;
        particleList.first = p.next;
      }
      else {
        particleList.first = null;
      }
    }
    else {
      if (p.next == null) {
        p.prev.next = null;
      }
      else {
        p.prev.next = p.next;
        p.next.prev = p.prev;
      }
    }
    //add to recycle bin
    if (recycleBin.first == null) {
      recycleBin.first = p;
      p.prev = null;
      p.next = null;
    }
    else {
      p.next = recycleBin.first;
      recycleBin.first.prev = p;
      recycleBin.first = p;
      p.prev = null;
    }
  }
}

// Variables for recording
var mediaRecorder = null;
var audioChunks = [];
var isRecording = false;

// DOM elements
const textInput = document.getElementById('textInput');
const sendButton = document.getElementById('sendButton');
const recordButton = document.getElementById('recordButton');
const statusElement = document.getElementById('status');
const chatHistory = document.getElementById('chatHistory');

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize chat with any existing conversation
    fetchConversationHistory();

    // Add event listeners
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    if (textInput) {
        textInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (recordButton) {
        recordButton.addEventListener('click', toggleRecording);
    }
    
    // Add decorative flowers
    createFlowers();
    createGrass();
});

// Create decorative flowers
function createFlowers() {
    const container = document.getElementById('decorative-elements');
    if (!container) return;
    
    // Create 10 random flowers
    for (let i = 0; i < 10; i++) {
        const flower = document.createElement('div');
        flower.className = 'flower';
        
        // Create petals - now with 8 petals for a more ornate look
        for (let j = 0; j < 8; j++) {
            const petal = document.createElement('div');
            petal.className = 'flower-petal';
            flower.appendChild(petal);
        }
        
        // Create center
        const center = document.createElement('div');
        center.className = 'flower-center';
        flower.appendChild(center);
        
        // Set random position
        flower.style.left = Math.random() * 90 + 'vw';
        flower.style.top = Math.random() * 80 + 10 + 'vh';
        
        // Set random animation delay
        flower.style.animationDelay = Math.random() * 2 + 's';
        
        // Add floating animation
        flower.style.animation = 'floating ' + (3 + Math.random() * 4) + 's infinite ease-in-out';
        
        container.appendChild(flower);
    }
}

// Create grass at the bottom of the page - styled to match the glowing image
function createGrass() {
    const container = document.getElementById('decorative-elements');
    if (!container) return;
    
    const grass = document.createElement('div');
    grass.className = 'grass';
    
    // Create blades of grass with a more intense glowing effect to match the image
    for (let i = 0; i < 120; i++) {
        const blade = document.createElement('div');
        blade.className = 'grass-blade';
        
        // Set random position and angle
        blade.style.left = i * 0.9 + '%';
        blade.style.height = 50 + Math.random() * 40 + 'px';
        blade.style.transform = 'rotate(' + (Math.random() * 20 - 10) + 'deg)';
        
        // Enhanced glow effect to match the image
        blade.style.filter = 'drop-shadow(0 0 5px rgba(0, 255, 0, 0.9))';
        blade.style.background = 'linear-gradient(to top, #00dd00, #00ff00)';
        blade.style.width = (2 + Math.random() * 2) + 'px';
        
        // Add enhanced glow animation
        blade.style.animationDelay = (Math.random() * 3) + 's';
        
        grass.appendChild(blade);
    }
    
    container.appendChild(grass);
}

// Fetch conversation history from the server
function fetchConversationHistory() {
    fetch('/get-conversation')
        .then(response => response.json())
        .then(data => {
            if (data.conversation && data.conversation.length > 0) {
                // Skip the first message which is the system prompt
                const messages = data.conversation.slice(1);

                // Display each message in the chat history
                messages.forEach(msg => {
                    if (msg.role === 'user') {
                        addMessageToChatHistory('user', msg.text);
                    } else if (msg.role === 'model') {
                        addMessageToChatHistory('ai', msg.text);
                    }
                });

                // Scroll to the bottom of the chat
                scrollToBottom();
            }
        })
        .catch(error => {
            console.error('Error fetching conversation history:', error);
        });
}

// Add a message to the chat history display
function addMessageToChatHistory(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;

    // Process message text to handle emojis and formatting
    let processedMessage = message.replace(/\n/g, '<br>');

    messageElement.innerHTML = `
        <div class="message-content">
            <p>${processedMessage}</p>
        </div>
    `;

    chatHistory.appendChild(messageElement);
    scrollToBottom();
}

// Scroll to the bottom of the chat history
function scrollToBottom() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Send a text message
function sendMessage() {
    const message = textInput.value.trim();

    if (message) {
        // Add the user's message to the chat display
        addMessageToChatHistory('user', message);

        // Clear the input field
        textInput.value = '';

        // Show loading indicator
        statusElement.textContent = 'Processing...';

        // Send the message to the server
        fetch('/send-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: message })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Wait for a response
                waitForResponse();
            } else {
                statusElement.textContent = 'Error: ' + data.error;
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
            statusElement.textContent = 'Error sending message';
        });
    }
}

// Wait for a response from the AI
function waitForResponse() {
    let attemptCount = 0;
    let lastResponse = null;
    let responseReceived = false;
    
    // Poll for a response
    const checkInterval = setInterval(() => {
        fetch('/get-response')
            .then(response => response.json())
            .then(data => {
                attemptCount++;
                
                if (data.response && !responseReceived) {
                    // Add the AI's response to the chat
                    lastResponse = data.response;
                    addMessageToChatHistory('ai', data.response);
                    responseReceived = true;

                    // Reset status
                    statusElement.textContent = 'Ready';

                    // Stop polling
                    clearInterval(checkInterval);
                    console.log("Response received and displayed");
                } else if (attemptCount > 50) {
                    // If too many attempts, stop polling
                    clearInterval(checkInterval);
                    statusElement.textContent = 'Response timed out';
                    console.log("Response timed out after 50 attempts");
                }
            })
            .catch(error => {
                console.error('Error checking for response:', error);
                attemptCount++;
                // Stop on excessive errors
                if (attemptCount > 10) {
                    clearInterval(checkInterval);
                    statusElement.textContent = 'Error retrieving response';
                }
            });
    }, 1000);

    // Set a timeout to stop polling after 30 seconds
    setTimeout(() => {
        if (!responseReceived) {
            clearInterval(checkInterval);
            if (statusElement.textContent === 'Processing...') {
                statusElement.textContent = 'Response timed out';
                console.log("Response timed out after 30 seconds");
            }
        }
    }, 30000);
}

// Toggle voice recording
function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
    
    // Update mic button appearance
    const recordButton = document.getElementById('recordButton');
    if (isRecording) {
        recordButton.style.backgroundColor = '#f44336'; // Red when recording
    } else {
        recordButton.style.backgroundColor = '#ff80ab'; // Pink when not recording
    }
}

// Start voice recording
async function startRecording() {
    audioChunks = [];

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Create audio context for processing
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

            try {
                // Convert blob to array buffer for processing
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // Get float32 samples from the buffer
                const samples = audioBuffer.getChannelData(0);

                // Process audio data
                statusElement.textContent = 'Processing audio...';

                // Send audio data to server for transcription
                const response = await fetch('/process-audio', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ audio: Array.from(samples) })
                });

                const result = await response.json();

                if (result.success) {
                    // Add transcribed text to chat
                    addMessageToChatHistory('user', result.text);
                    statusElement.textContent = 'Transcribed: ' + result.text;

                    // Wait for AI response
                    waitForResponse();
                } else {
                    statusElement.textContent = 'Error: ' + result.error;
                }
            } catch (error) {
                console.error('Error processing audio:', error);
                statusElement.textContent = 'Error processing audio';
            }
        };

        mediaRecorder.start();
        isRecording = true;

        recordButton.textContent = 'Stop Recording';
        statusElement.textContent = 'Recording...';

        // Update UI to show recording state
        const siriContainer = document.getElementById("siri-container");
        const oval = document.getElementById("Oval");

        if (siriContainer) siriContainer.style.display = "block";
        if (oval) oval.style.display = "none";

    } catch (err) {
        console.error('Error accessing microphone:', err);
        statusElement.textContent = 'Error: ' + err.message;
    }
}

// Stop voice recording
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        recordButton.textContent = 'Start Recording';
        statusElement.textContent = 'Processing audio...';

        // Update UI to hide recording state
        const siriContainer = document.getElementById("siri-container");
        const oval = document.getElementById("Oval");

        if (siriContainer) siriContainer.style.display = "none";
        if (oval) oval.style.display = "flex";
    }
}
