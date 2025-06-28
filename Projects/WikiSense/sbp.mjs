import dotenv from 'dotenv'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai'
import { QdrantVectorStore } from '@langchain/qdrant'
import 'cheerio'
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import ora from 'ora'
import chalk from 'chalk'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { pull } from 'langchain/hub'
import { Annotation } from '@langchain/langgraph'
import { StateGraph } from '@langchain/langgraph'
import fs from 'fs'
import { exec } from 'node:child_process'

dotenv.config()

async function main(webUrl, question) {
    let llm, vectorStore

    // === SETUP & INSTANTIATION ===
    const spinnerInstantiate = ora('Instantiation... \n').start()
    try {
        llm = new ChatGoogleGenerativeAI({
            model: 'gemini-2.0-flash',
            temperature: 0
        })

        const embeddings = new GoogleGenerativeAIEmbeddings({
            model: 'text-embedding-004'
        })

        vectorStore = await QdrantVectorStore.fromExistingCollection(
            embeddings,
            {
                url: process.env.QDRANT_URL,
                collectionName: 'step-back-prompting'
            }
        )

        spinnerInstantiate.succeed('Instantiation Done. \n')
    } catch (error) {
        console.error(`Error during Instantiation: ${error}`)
        spinnerInstantiate.fail('Failed to instantiate\n')
        return
    }

    // === INDEXING ===
    const spinnerIndex = ora('Indexing Process... \n').start()
    try {
        const loader = new CheerioWebBaseLoader(webUrl, { selector: 'p' })
        const docsRaw = await loader.load()

        const docs = docsRaw.map((doc) => ({
            pageContent: doc.pageContent,
            metadata: { source: webUrl }
        }))

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
        })
        const allSplits = await splitter.splitDocuments(docs)

        const spinnerDocs = ora('Adding Documents to Vector Store... \n').start()
        await vectorStore.addDocuments(allSplits)
        spinnerDocs.succeed('Documents Added. \n')
        spinnerIndex.succeed('Indexing Done. \n')
    } catch (error) {
        console.error(`Error during Indexing: ${error}`)
        spinnerIndex.fail('Failed to Index\n')
        return
    }

    // === STEP-BACK PROMPTING ===
    const queryGeneratorPrompt = `
You are a helpful assistant that instead of answering, first reframes the question into a more general or insightful version.
Then answer that version and apply it back to the original.
Generate the general or insightful version related to: "${question}"
Output ONLY as a raw JSON array, no explanation, no code block, no backticks.
Example: ["step1", "step2", "step3"]
`

    let queryVariations
    try {
        const queryResponse = await llm.invoke(queryGeneratorPrompt)
        let cleanedContent = queryResponse.content.trim()

        if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/```(json)?/g, '').trim()
        }

        const parsed = JSON.parse(cleanedContent)
        // Assign abstraction levels to queries
        queryVariations = parsed.map((q, idx) => ({
            question: q,
            level: `abstract-level-${idx + 1}`
        }))
    } catch (error) {
        console.error('Error parsing query response:', error)
        queryVariations = [{ question, level: 'original' }]
    }

    // Always include original question last
    queryVariations.push({ question, level: 'original' })

    const promptTemplate = await pull('rlm/rag-prompt')

    // === STATE DEFINITIONS ===
    const StateAnnotation = Annotation.Root({
        question: Annotation,
        context: Annotation,
        answer: Annotation,
        level: Annotation,
        sourceQuestion: Annotation
    })

    // === RETRIEVE FUNCTION (Level-based logic) ===
    const retrieve = async (state) => {
        // Adjust depth based on abstraction level
        const k = state.level?.includes('abstract') ? 4 : 2
        const resultsArrays = await vectorStore.similaritySearch(state.question, k)

        return {
            context: resultsArrays
        }
    }

    // === GENERATE FUNCTION ===
    const generate = async (state) => {
        const docsContent = state.context.map((doc) => doc.pageContent).join('\n')

        const promptString = await promptTemplate.format({
            question: state.question,
            context: docsContent
        })

        const response = await llm.invoke(promptString)

        return {
            answer: response.content
        }
    }

    // === LANGGRAPH FLOW ===
    const graph = new StateGraph(StateAnnotation)
        .addNode('retrieve', retrieve)
        .addNode('generate', generate)
        .addEdge('__start__', 'retrieve')
        .addEdge('retrieve', 'generate')
        .addEdge('generate', '__end__')
        .compile()

    let result

    // === LOOP THROUGH VARIATIONS ===
    for (const item of queryVariations) {
        const inputs = {
            question: item.question,
            level: item.level,
            sourceQuestion: question
        }

        result = await graph.invoke(inputs)

        console.log(
            `\n${chalk.yellowBright('Level:')} ${item.level}`,
            `\n${chalk.magentaBright('Query:')} ${chalk.red(item.question)}`,
            `\n${chalk.magentaBright('Answer:')} ${chalk.cyanBright(result.answer)}\n`
        )

        const logEntry = {
            timestamp: new Date().toISOString(),
            website: webUrl,
            level: item.level,
            originalQuestion: question,
            query: item.question,
            answer: result.answer
        }
        fs.appendFileSync('rag_logs.json', JSON.stringify(logEntry) + '\n')
    }

    // === FINAL DISPLAY ===
    console.log(
        '\n' + chalk.bgGreen.bold.black(' Final Response :'),
        chalk.greenBright.bold(result.answer)
    )

    // === LOGS FORMATTER (Optional Script) ===
    exec('node logsFormatter.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Formatter error: ${error.message}`)
            return
        }
        if (stderr) {
            console.error(`Formatter stderr: ${stderr}`)
            return
        }
        console.log(`${stdout}`)
    })
}

// === CLI INPUT ===
const rl = readline.createInterface({ input, output })
const webUrl = await rl.question(chalk.bold.blue(`\nEnter the URL of the website: `))
const question = await rl.question(chalk.bold.blue('\nEnter your question: '))
console.log('\n')
rl.close()

// === INVOKE MAIN ===
main(webUrl, question)
