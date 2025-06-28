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
    // Global Variables
    let llm
    let vectorStore

    // INSTANTIATION PROCESS Starts
    const spinnerInstantiate = ora(`Instantiating... \n`).start()

    try {
        // Instantiating Gemini Chat
        llm = new ChatGoogleGenerativeAI({
            model: 'gemini-2.0-flash',
            temperature: 0
        })

        // Instantiating Embeddings
        const embeddings = new GoogleGenerativeAIEmbeddings({
            model: 'text-embedding-004'
        })

        // Instantiating Vector Store
        vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            url: process.env.QDRANT_URL,
            collectionName: 'chain-of-thought'
        })

        spinnerInstantiate.succeed('Instantiation Done. \n')
    } catch (error) {
        console.log(`Error during instantiating : ${error}`)
        spinnerInstantiate.fail('Failed to instantiate')
    }
    // INSTANTIATION Done

    // INDEXING PROCESS Starts
    const spinnerIndex = ora('Indexing Process... \n').start()
    try {
        // Document loading using cheerio
        const pTagSelector = 'p'
        const cheerioLoader = new CheerioWebBaseLoader(webUrl, {
            selector: pTagSelector
        })

        const docsRaw = await cheerioLoader.load()

        // Patch : add metadata {source: url}
        const docs = docsRaw.map(doc => ({
            pageContent: doc.pageContent,
            metadata: { source: webUrl }
        }))

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
        })

        const allSplits = await splitter.splitDocuments(docs)

        // Storing Chunks in Vector Store
        const spinnerDocs = ora('Documents (Chunks) added to vector store.\n').start()

        try {
            await vectorStore.addDocuments(allSplits)
            spinnerDocs.succeed('Documents (Chunks) added to vector store. \n')
        } catch (error) {
            console.log('Error adding documents to vector store: ', error)
            spinnerDocs.fail('Failed to add Documents to vector store.\n')
        }

        spinnerIndex.succeed('Indexing Process Done.\n')
    } catch (error) {
        console.log(`Error indexing documents : ${error}`)
        spinnerIndex.fail('Failed to index documents.\n')
    }

    // INDEXING Done

    // RETRIEVAL PROCESS Starts
    const promptTemplate = await pull('rlm/rag-prompt')

    const InputStateAnnotation = Annotation.Root({
        question: Annotation
    })

    const StateAnnotation = Annotation.Root({
        question: Annotation,
        context: Annotation,
        answer: Annotation
    })

    let queryVariations
    let result

    // Generating Sub-Queries
    const queryGeneratorPrompt = `You are a helpful assistant that generates multiple sub-queries related to an input question. The goal is to break down the input into a set of sub-problems/ sub-questions that can be answered in isolation.
    Generate multiple search queries related to : "${question}"
    Output (3 queries) ONLY with a raw JSON array, no explanation, no code block, no backticks. Example ["step1","step2","step3"]
    `
    const queryResponse = await llm.invoke(queryGeneratorPrompt)

    let cleanedContent = queryResponse.content.trim()
    if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/```(json)?/g, '').trim()
    }

    try {
        queryVariations = JSON.parse(cleanedContent) // parse the LLM response
    } catch (error) {
        console.error('Error parsing LLM generated response', error)
        queryVariations = [question] // fallback : just use the base question
    }

    // Retrieving Function
    const retrieve = async (state) => {
        const resultsArray = await vectorStore.similaritySearch(state.question, 2)
        const hasContextElements = state.context?.length
        return {
            context: hasContextElements ? [...state.context, ...resultsArray] : resultsArray // Setting retrieved data as context for the next subquery
        }
    }

    //  Generate Function
    const generate = async (state) => {
        const docsContent = state.context.map((doc) => doc.pageContent).join('\n')
        const messages = await promptTemplate.invoke({
            question: state.question,
            context: docsContent
        })

        const response = await llm.invoke(messages)

        return { answer: response.content, context: response.content }
    }

    // Defining Graph Nodes & Edges
    const graph = new StateGraph(StateAnnotation)
        .addNode('retrieve', retrieve)
        .addNode('generate', generate)
        .addEdge('__start__', 'retrieve')
        .addEdge('retrieve', 'generate')
        .addEdge('generate', '__end__')
        .compile()

    // 2-, 5-, 8- Running Graph Stream here
    for (const query of queryVariations) {
        let inputs = { question: query }
        result = await graph.invoke(inputs)

        console.log(
            '\n Query: ',
            chalk.red(query) + '\n Answer: ',
            chalk.cyanBright(result['answer'])
        )

        // Store the log
        const logEntry = {
            function: 'Chatbot_ChainOfThoughts',
            timestamp: new Date().toISOString(),
            website: webUrl,
            originalQuestion: question,
            query: query,
            answer: result['answer']
        }
        fs.appendFileSync('rag_logs.json', JSON.stringify(logEntry) + '\n')
    }
    console.log(
        '\n',
        chalk.bgGreen.bold.black(' Final Response :'),
        chalk.bold.greenBright(result['answer'])
    )

    // Formatting Logs
    exec('node logsFormatter.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script : ${error.message}`)
            return
        }
        if (stderr) {
            console.error(`Script error : ${stderr}`)
            return
        }

        console.log(`${stdout}`)
    })
}

const rl = readline.createInterface({ input, output })
const webUrl = await rl.question(
    chalk.bold.blue`\nEnter the URL of the website: `
)

const question = await rl.question(chalk.bold.blue`\nEnter your question:`)
console.log('\n')
rl.close()
main(webUrl, question)