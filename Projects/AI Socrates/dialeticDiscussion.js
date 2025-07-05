import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import player from 'play-sound';

dotenv.config();
const API_KEY = process.env.GEMINI_API_KEY;

// Ask user input from terminal
const readline = await import('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askInput(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

async function callGemini(text) {
    const body = {
        system_instruction: {
            parts: [{
                text: `You are an AI conversation model which follows the dialectic method of Socrates. Be honest and short.`
            }]
        },
        contents: [
            {
                parts: [{ text }]
            }
        ]
    };

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function generateTTS(text) {
    const requestBody = {
        contents: [
            {
                parts: [{ text }]
            }
        ],
        generationConfig: {
            responseModalities: ["AUDIO"]
        },
        model: "gemini-2.5-flash-preview-tts"
    };

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    const data = await res.json();
    const base64Audio = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
}

function saveAudio(base64Data, outputPath) {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`🔊 Audio saved as ${outputPath}`);
}

// Optional: play using ffplay or play-sound
function playPCM(path) {
    const audio = player();
    audio.play(path, err => {
        if (err) console.error("Playback error:", err);
    });
}

async function main() {
    const input = await askInput("🧠 Ask a philosophical question: ");
    const response = await callGemini(input);

    console.log(`🤖 Gemini: ${response}`);

    const audioBase64 = await generateTTS(response);
    const pcmPath = './output.pcm';

    saveAudio(audioBase64, pcmPath);
    playPCM(pcmPath); // Requires `ffplay`, `aplay`, or `afplay` to be installed

    rl.close();
}

main();
