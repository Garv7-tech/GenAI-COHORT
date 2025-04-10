// Get input elements value
const InputArea = document.getElementById('InputArea')
const encodedSequenceOutput = document.getElementById('encodedSequenceOutput')
const tokenOutput = document.getElementById('tokenOutput')
const tokenizeBtn = document.getElementById('tokenizeBtn')

// Function to tokenize input text
function tokenizer() {
    const inputSequence = InputArea.value
    const encodedArray = inputSequence.split(' ')
    let tokenizedSequence = {}

    // Calculate ASCII sum for each word
    encodedArray.forEach((word) => {
        let asciiSum = 0
        for (let i = 0; i < word.length; i++) {
            asciiSum += word.charCodeAt(i)
        }
        tokenizedSequence[word] = asciiSum
    })

    displayOutput(encodedArray, tokenizedSequence)
}

// Convert token number to RGB color
function tokenToColor(tokenNumber) {
    let r = (tokenNumber * 70) % 255
    let g = (tokenNumber * 120) % 255
    let b = (tokenNumber * 200) % 255

    return `rgb(${r},${g},${b})`
}

// Display tokenized output with colors
function displayOutput(encodedArray, tokenizedSequence) {
    encodedSequenceOutput.innerHTML = ''

    // Create colored spans for each word
    encodedArray.forEach((word) => {
        const tokenValue = tokenizedSequence[word]
        const color = tokenToColor(tokenValue)

        const span = document.createElement('span')
        span.textContent = word + ' '
        span.style.color = color

        encodedSequenceOutput.appendChild(span)
    })

    // Generate token summary text
    let tokenText = ''
    for (const word in tokenizedSequence) {
        tokenText += `${word}: ${tokenizedSequence[word]};\n`
    }
    tokenOutput.textContent = tokenText

    // Set outputs as readonly
    encodedSequenceOutput.setAttribute('readonly', 'true')
    tokenOutput.setAttribute('readonly', 'true')
}

// Add click event listener to tokenize button
tokenizeBtn.addEventListener('click', tokenizer)