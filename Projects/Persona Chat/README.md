# 🤖 Persona Chat

**Persona Chat** is a terminal-based chatbot that lets you interact with your favorite tech educators and software developers—powered by Gemini LLM! Get answers in Hinglish and English, with responses crafted in the unique tone and style of the educator’s social media persona.

---

## ✨ Features

- **Impersonate Top Tech Educators:** Chat as if you’re talking directly to your favorite influencer.
- **Hinglish & English Replies:** Blended, natural responses that match the educator’s real communication style.
- **Easy CLI Experience:** No setup hassle—just run and chat!
- **Customizable Personas:** Add any educator or influencer by providing their name and social media links.
- **Powered by Gemini LLM:** Cutting-edge language model for authentic, engaging conversations.

---

## 🎬 Demo

*Check out the screen recording below to see Persona Chat in action!*

<video controls src="../Persona Chat/Recording 2025-06-09 072316.mp4" title="Persona Chat Demo"></video>

---

## 🚧 Coming Soon: UI Version!

We’re working on a sleek web UI for Persona Chat! Soon, you’ll be able to interact with your favorite personas in a modern, user-friendly interface—stay tuned for updates.

---

## 🛠️ Getting Started

### 1. Clone the Repository

```sh
git clone https://github.com/yourusername/persona-chat.git
cd persona-chat
```

### 2. Install Dependencies

```sh
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the project root and add your Gemini API key:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Start Chatting

Run the chatbot with your chosen persona:

```sh
node talk.js "<Persona Name>" '{"socialMediaName":"<Persona Name>","profileLinks":{"YouTube":"<YouTube URL>","X":"<X URL>"}}'
```

Example for Hitesh Choudhary:

```sh
npm run hc
```

Or for Piyush Garg:

```sh
npm run pg
```

---

## 🧑‍💻 Add Your Own Persona

Just provide the persona’s name and their social media links as a JSON object when running the CLI. See the scripts in [package.json](../Personas Chat/package.json) for examples.

---

## 📦 Project Structure

- [`talk.js`](../Personas Chat/talk.js): Main CLI chatbot logic
- [`package.json`](../Personas Chat/package.json): Scripts and dependencies
- [`docker-compose.db.yml`](../Personas Chat/docker-compose.db.yml): Qdrant vector database (optional, for future features)

---
## 📢 Stay Tuned

- Web UI version coming soon!
- More personas and features on the way.

---
## 👨‍💻 Author

 [Garv7-tech](https://github.com/Garv7-tech)

---
## ⭐️ Support

If you like this project, consider starring the repo and sharing it! 🌟  
Feedback are always welcome.

---

**Made with ❤️ for the developer community.**



