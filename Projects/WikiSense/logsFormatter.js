const fs = require('fs')
const path = require('path')

// Input file (original raw logs)
const inputFilePath = path.join(__dirname, 'rags_logs.json')

// Output file (formatted logs)
const outputFilePath = path.join(__dirname, 'rags_logs.yaml')

try {
    // Read raw logs
    const rawData = fs.readFileSync(inputFilePath,'utf-8')

    // Split logs by lines, parse each JSON line
    const logs = rawData
    .split('\n')
    .filter(Boolean)
    .map((line)=>JSON.parse(line))

    // Build formatted string
    const formattedLogs = logs
    .map((log)=>{
        const entries = Object.entries(log)
        .map(([key, value])=>`${key}:${value}`)
        .join('\n')

        return `${entries}\n--------LOG SEPARATOR--------`
    })
    .join('\n\n') // Two newlines between logs

    // Write to the new output file
    fs.appendFileSync(outputFilePath, formattedLogs)

    console.log('\n✅ Logs saved to rag_logs.yaml !\n')

    // Delete old file
    fs.unlinkSync(inputFilePath)
} catch (error) {
    console.error(`\n❌ Error processing logs: ${error}`)
}
