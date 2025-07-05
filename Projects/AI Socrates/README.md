# 🧠 AI Socrates

**AI Socrates** is an interactive command-line tool that lets you engage in philosophical discussions with an AI modeled after the dialectic method of Socrates. Ask any philosophical question and receive concise, honest answers—then listen to the AI's response as audio!

---

## ✨ Features

- **Dialectic Conversations:** Get answers in the style of Socratic questioning.  
- **Text-to-Speech:** Converts AI responses to audio using Gemini's TTS API.  
- **Audio Playback:** Instantly listen to the AI's reply.  
- **Easy to Use:** Simple command-line interface.  

---

## 🚀 Getting Started

### 1. Clone the Repository

```sh
git clone https://github.com/yourusername/ai-socrates.git
cd ai-socrates
````

### 2. Install Dependencies

```sh
npm install
```

### 3. Set Up API Key

Create a `.env` file in the project root and add your Gemini API key:

```
GEMINI_API_KEY=your_api_key_here
```

### 4. Run the Application

```sh
node dialeticDiscussion.js
```

---

## 🗣️ Usage

* Run the script.
* Enter your philosophical question when prompted.
* Read the AI's answer in the terminal.
* Listen to the AI's answer as audio (requires `ffplay`, `aplay`, or `afplay` installed).

---

## ⚙️ Requirements

* Node.js v18+
* `ffplay`, `aplay`, or `afplay` for audio playback

---

## 🙏 Acknowledgements

* Google Gemini API
* [`play-sound`](https://www.npmjs.com/package/play-sound)
* Socratic Method inspiration

