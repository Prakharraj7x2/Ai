
import os
import json

from flask import Flask, render_template, request, jsonify, send_from_directory
import speech_recognition as sr
import numpy as np
import threading
import os
import time

app = Flask(__name__, template_folder='web', static_folder='web')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('web', path)

from time import sleep
from datetime import datetime, timedelta

last_request_time = datetime.now()
MIN_REQUEST_INTERVAL = 2  # seconds

# Create a variable to store the latest AI response
latest_response = None
response_fetched = False

@app.route('/get-conversation', methods=['GET'])
def get_conversation():
    try:
        if os.path.exists("conversation.json"):
            with open("conversation.json", "r", encoding='utf-8') as f:
                conversation = json.load(f)
                return jsonify({"success": True, "conversation": conversation})
        return jsonify({"success": True, "conversation": []})
    except Exception as e:
        print(f"Error reading conversation: {e}")
        return jsonify({"success": False, "error": str(e)})

@app.route('/send-text', methods=['POST'])
def send_text():
    global response_fetched, latest_response
    try:
        if not request.is_json:
            return jsonify({"success": False, "error": "Expected JSON data"})
            
        text = request.get_json().get('text')
        if not text:
            return jsonify({"success": False, "error": "No text received"})
            
        # Reset the response fetched flag and latest response
        response_fetched = False
        latest_response = None
        
        # Write the text to a file for the main.py script to process
        with open("transcribed_input.txt", "w") as f:
            f.write(text)
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/get-response', methods=['GET'])
def get_response():
    global latest_response, response_fetched
    
    # Check for a new response in the conversation.json file
    try:
        if os.path.exists("conversation.json"):
            with open("conversation.json", "r", encoding='utf-8') as f:
                conversation = json.load(f)
                
                # Find most recent user message
                latest_user_index = -1
                for i in range(len(conversation) - 1, -1, -1):
                    if conversation[i].get("role") == "user":
                        latest_user_index = i
                        break
                
                if latest_user_index >= 0:
                    # Find the most recent model response after the latest user input
                    for i in range(latest_user_index + 1, len(conversation)):
                        if conversation[i].get("role") == "model":
                            # Return the response if it hasn't been fetched yet
                            current_response = conversation[i].get("text", "")
                            if current_response and not response_fetched:
                                latest_response = current_response
                                response_fetched = True
                                print(f"Found new response: {latest_response[:30]}...")
                                return jsonify({"response": latest_response})
    except Exception as e:
        print(f"Error reading conversation: {e}")
    
    # If we're here, no new response was found or response was already fetched
    return jsonify({"response": None})

@app.route('/process-audio', methods=['POST'])
def process_audio():
    global last_request_time, response_fetched
    
    # Add rate limiting
    current_time = datetime.now()
    time_since_last_request = (current_time - last_request_time).total_seconds()
    
    if time_since_last_request < MIN_REQUEST_INTERVAL:
        sleep(MIN_REQUEST_INTERVAL - time_since_last_request)
    
    last_request_time = current_time
    
    try:
        if not request.is_json:
            return jsonify({"success": False, "error": "Expected JSON data"})
            
        audio_data = request.get_json().get('audio')
        if not audio_data:
            return jsonify({"success": False, "error": "No audio data received"})

        try:
            # Convert float audio data to int16 for speech recognition
            audio_array = np.array(audio_data, dtype=np.float32)
            audio_array = (audio_array * 32767).astype(np.int16)
            audio_bytes = audio_array.tobytes()
            
            print("Audio data converted successfully")
        except Exception as e:
            print(f"Error converting audio data: {str(e)}")
            return jsonify({"success": False, "error": f"Error converting audio data: {str(e)}"})

        recognizer = sr.Recognizer()
        try:
            # Create an AudioData object with the correct parameters
            # Note: sample_rate and sample_width must match what the browser sends
            audio = sr.AudioData(audio_bytes, sample_rate=44100, sample_width=2)
            text = recognizer.recognize_google(audio)
            print(f"\nTranscribed text: {text}")
        except sr.UnknownValueError:
            return jsonify({"success": False, "error": "Could not understand audio"})
        except sr.RequestError as e:
            error_msg = str(e)
            if "quota" in error_msg.lower():
                return jsonify({"success": False, "error": "Speech recognition quota exceeded. Please try again in a few minutes."})
            return jsonify({"success": False, "error": f"Could not request results: {error_msg}"})
        except Exception as e:
            print(f"Error during transcription: {str(e)}")
            return jsonify({"success": False, "error": f"Error during transcription: {str(e)}"})

        try:
            # Reset the response fetched flag
            response_fetched = False
            
            # Write the transcribed text immediately to be processed by main.py
            print(f"\nTranscribed: {text}")
            with open("transcribed_input.txt", "w", buffering=1) as f:
                f.write(text)
            return jsonify({"success": True, "text": text})
        except Exception as e:
            print(f"Error saving transcription: {str(e)}")
            return jsonify({"success": False, "error": f"Error saving transcription: {str(e)}"})

    except Exception as e:
        print(f"Error processing audio: {str(e)}")
        return jsonify({"success": False, "error": f"General error: {str(e)}"})

def start_flask():
    import logging
    log = logging.getLogger('werkzeug')
    log.disabled = True
    app.logger.disabled = True
    app.run(host='0.0.0.0', port=8080, debug=False, threaded=True, use_reloader=False)

def run_flask_in_thread():
    flask_thread = threading.Thread(target=start_flask)
    flask_thread.daemon = True
    flask_thread.start()
