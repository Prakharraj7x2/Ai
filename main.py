import json
import os
import google.generativeai as genai
import asyncio
import edge_tts
import requests
import datetime
import pytz
import smtplib
import ssl
from email.message import EmailMessage
# Send email
email_sender = 'programmer01010101p@gmail.com'
email_password = 'rlrj vset xwdg sjzg' # Replace with your actual 16-digit App Password
email_receiver = 'technicalbros55@gmail.com'


def send_email(sender, password, receiver, subject, body):
    em = EmailMessage()
    em['From'] = sender
    em['To'] = receiver
    em['Subject'] = subject
    em.set_content(body)

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=context) as smtp:
        smtp.login(sender, password)
        smtp.sendmail(sender, receiver, em.as_string())
    return "Email sent successfully"


            # To get the correct local time

# Location
LAT = "25.044113"
LON = "83.614035"

# Import and start Flask server
import logging
logging.getLogger().setLevel(logging.ERROR)
from Flask import run_flask_in_thread
run_flask_in_thread()

# Configure API key
genai.configure(api_key="AIzaSyCDiNfvdiN8EuQNM4ZeYJ0lJfgiTZvjOq4")

# Function to get the current weather from Open-Meteo (NO API KEY NEEDED)
def get_weather():
    url = f"https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&current=temperature_2m,weathercode"
    try:
        response = requests.get(url)
        data = response.json()
        temperature = data["current"]["temperature_2m"]
        weather_code = data["current"]["weathercode"]

        # Interpret temperature (adjust thresholds as needed)
        if temperature < 10:
            temp_feeling = "cold"
        elif 10 <= temperature < 25:
            temp_feeling = "pleasant"
        else:
            temp_feeling = "hot"

        return f"and also the temperature is {temperature}°C, you might feel {temp_feeling} there."
    except Exception as e:
        return "I couldn't fetch the weather right now."


# Set up the model
generation_config = {
    "temperature": 2,
    "top_p": 0.95,
    "top_k": 0,
    "max_output_tokens": 8192,
}

safety_settings = []

# Initialize the generative model
model = genai.GenerativeModel(
    model_name="gemini-1.5-pro-latest",
    generation_config=generation_config,
    safety_settings=safety_settings
)

# File paths
history_file = "conversation.json"
audio_file = "response.mp3"
weather_info = get_weather()

# Load previous chat history
def load_history():
    if os.path.exists(history_file):
        with open(history_file, "r", encoding="utf-8") as file:
            try:
                history_data = json.load(file)
                if isinstance(history_data, list):
                    return [{"role": msg["role"], "parts": [{"text": msg["text"]}]} for msg in history_data]
            except json.JSONDecodeError:
                pass
    return []

history = load_history()

# AI personality (sent once at the beginning)
Username = "Prakhar"
Name = "Kaguya"
m = "answer a bit longer like a normal person (in 10-15 words for questions like hi/hello)"
initial_prompt = f"Hello, I am {Username}, and you are a very cute , humble , loving frmale AI named {Name}. You were created to assist people and talk in a friendly cute manner. You have to {m}."

# Only send initial prompt if history is empty
if not history:
    history.append({"role": "user", "parts": [{"text": initial_prompt}]})

# Initialize conversation
convo = model.start_chat(history=history)

# Function to delete old audio
def delete_old_audio():
    if os.path.exists(audio_file):
        os.remove(audio_file)

# Function to get current time dynamically
def get_time_info():
    local_tz = pytz.timezone("Asia/Kolkata")  # Change to your region
    current_date_time = datetime.datetime.now(local_tz)
    day = current_date_time.strftime("%A")
    date = current_date_time.strftime("%d %B %Y")
    time = current_date_time.strftime("%H:%M")

    return f"{initial_prompt}.Right now, it's {day}, {date}, and the time is {time} , it is not necessary but you can remember that {weather_info}"

# Function to save and play AI response as speech
async def speak_response(text):
    delete_old_audio()  
    voice = "en-IE-EmilyNeural"
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(audio_file)

# Store responses for later speech synthesis
responses_to_speak = []

# Chat loop
while True:
    # Check for transcribed input first
    try:
        if os.path.exists("transcribed_input.txt"):
            with open("transcribed_input.txt", "r", buffering=1) as f:
                user_input = f.read().strip()
                print(f"\nYou (voice): {user_input}")

            # Process the transcribed input immediately
            current_time = datetime.datetime.now(pytz.timezone('Asia/Kolkata')).strftime('%H:%M')
            response = convo.send_message(f"The time is {current_time} {user_input}")
            ai_response = response.text
            print(f"Kaguya: {ai_response}")
            responses_to_speak.append(ai_response)

            # Delete the file after processing
            os.remove("transcribed_input.txt")

        user_input = input("You: ")

        if user_input.lower() == "stop":
            print("Converting all responses to speech...")
            # Convert all stored responses to speech
            for response in responses_to_speak:
                asyncio.run(speak_response(response))
            break  # Exit the loop

    except Exception as e:
        print(f"Error handling user input: {e}")
        continue

    try:
        # Only send the time info without the initial prompt
        current_time = f"The time is {datetime.datetime.now(pytz.timezone('Asia/Kolkata')).strftime('%H:%M')}"

        # Send message with current time
        response = convo.send_message(f"{current_time} {user_input}")
        ai_response = response.text
        print(f"Kaguya: {ai_response}")

        # Store response for later speech synthesis
        responses_to_speak.append(ai_response)

        # Auto-save conversation after each message
        formatted_history = []
        for msg in convo.history:
            if hasattr(msg, 'role') and hasattr(msg, 'parts') and msg.parts:
                formatted_history.append({
                    "role": msg.role,
                    "text": msg.parts[0].text if msg.parts[0].text else ""
                })
        with open(history_file, "w", encoding="utf-8") as file:
            json.dump(formatted_history, file, indent=4, ensure_ascii=False)

    except Exception as e:
        print(f"Error communicating with the AI: {e}")

    if user_input.lower() == "send":
        try:
            result = send_email(email_sender, email_password, email_receiver, "Chat Session Complete", "Your chat session has ended.")
            print(result)
        except Exception as e:
            print(f"Error sending email: {e}")