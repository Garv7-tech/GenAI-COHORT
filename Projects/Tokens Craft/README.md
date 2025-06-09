# 🎨 TokenCraft — Text Tokenization Visualizer

![GitHub Repo stars](https://img.shields.io/github/stars/Garv7-tech/GenAI-COHORT?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/Garv7-tech/GenAI-COHORT?style=flat-square)
![Made with HTML](https://img.shields.io/badge/Made%20with-HTML%2FCSS%2FJS-blueviolet?style=flat-square)

> ✨ A beautifully simple and visual way to tokenize your input text and see the magic of ASCII-based tokenization — color-coded and interactive!

---

## 🚀 Live Demo

🔗 [**Check out the app**](https://)  
🌐 Hosted with ❤️ on Vercel

---

## 🖼️ Preview

![TokenCraft Screenshot](<https://media-hosting.imagekit.io/0b414710a80c4f74/Screenshot%202025-04-10%20172951.png?Expires=1838896039&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=hn6stJzs33~OXMSZrlXUkr7hgfzrXIVOnA9csbs~B47MxrhxpaWu6RBqJrNI~We52iA9VZ~dedGePhqjIMarClV5y~G-WiFnMIRrjil2mUg1bRNBTXxn5LJ64sj6Yy29NWWTYiiwLL5SXrnu9Um0nQMvPnN~UF1YOAnUQDQ0ou6JpjP7aFnYTRM3Ua0li9GmsV5cDdH~8FiotiF2kQr5SvVWKrHnFcWNDkl7QohZhBIsjlM9N5mV0ZZGVe11Wsip69HxQtzAhzys~cyBVd71lgBQV9RKyisSS~wEEsxZq4BcfsMOcUzifNUA4feduDydhJgP9rPDwTr-R90R6E2lrA__>)

> Tokenized output is color-coded based on ASCII value sums of each token (word)!

---

## 🛠️ Features

- ✅ Tokenizes input text word-by-word
- ✅ Computes ASCII-based encoding for each token
- ✅ Generates beautiful RGB color mappings
- ✅ Dynamically renders colored tokens
- ✅ Clean and responsive UI
- ✅ No frameworks — just vanilla HTML/CSS/JS

---

## 💡 How It Works

Each word is converted into a token by summing the ASCII values of its characters. Then a unique color is generated using that number and applied to visually differentiate each token.

```js
function tokenToColor(tokenNumber) {
    let r = (tokenNumber * 70) % 255;
    let g = (tokenNumber * 120) % 255;
    let b = (tokenNumber * 200) % 255;
    return `rgb(${r}, ${g}, ${b})`;
}
```

---

## 📂 Project Structure

```
.
├── index.html
├── style.css
├── script.js
└── screenshot.png
```

---

## 👨‍💻 Author

 [Garv7-tech](https://github.com/Garv7-tech)

---
## ⭐️ Support

If you like this project, consider starring the repo and sharing it! 🌟  
Feedback are always welcome.

