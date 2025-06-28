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
    let llm
    let vectorStore

    // INSTANTIATION PROCESS Starts
    const spinnerInstantiate = ora('Instantiating...\n').start()
    try {
        // Instantiate Gemini Chat
        llm = new ChatGoogleGenerativeAI({
            model: 'gemini-2.0-flash',
            temperature: 0
        })
        // Instantiate Embeddings
        const embeddings = new GoogleGenerativeAIEmbeddings({
            model: 'text-embedding-004'
        })

        // Instantiate Vector Store
        vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            url: process.env.QDRANT_URL,
            collectionName: 'hypothetical-document-embedding'
        })

        spinnerInstantiate.succeed('Instantiating Done.\n')
    } catch (error) {
        console.log(`Error during instantiation : ${error}`)
        spinnerInstantiate.fail('Failed to Instantiate.\n')
    }
    // INSTANTIATION PROCESS Done

    // INDEXING PROCESS Starts
    const spinnerIndex = ora('Indexing Process...\n').start()
    try {
        // Document Loading Using cheerio
        const pTagSelector = 'p'
        const cheerioLoader = new CheerioWebBaseLoader(webUrl, {
            selector: pTagSelector
        })

        const docs = await cheerioLoader.load()

        // Text splitting
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
        })

        const allSplits = await splitter.splitDocuments(docs)

        // Storing chunks in vector store
        const spinnerDocs = ora('Adding documents (Chunks) to vector store...\n').start()

        try {
            await vectorStore.addDocuments(allSplits)
            spinnerDocs.succeed('Documents (Chunks) added to vector store.\n')
        } catch (error) {
            console.log('Error adding documents to vector store:', error)
            spinnerDocs.fail('Failed to add documents (Chunks) to vector store.\n')
        }
        spinnerIndex.succeed('Indexing Process Done.\n')
    } catch (error) {
        console.log(`Error Indexing documents : ${error}`)
        spinnerIndex.fail('Failed to index documents.\n')
    }
    // INDEXING PROCESS Done

    // RETRIEVING PROCESS Starts
    const promptTemplate = await pull('rlm/rag-prompt')

    const StateAnnotation = Annotation.Root({
        question: Annotation,
        context: Annotation,
        answer: Annotation
    })

    let docContent
    let result

    // Prompt running part
    const queryGeneratorPrompt = `
    You are an Intelligent Assistant who writes a paragraph to answer a question. Goal is to generate a paragraph to answer "${question}" in JSON format. 
    Output ONLY with a raw JSON array, no explanation, no code block, no backticks.
    Example : ["content"]
    `
    const queryResponse = await llm.invoke(queryGeneratorPrompt)
    let cleanedContent = queryResponse.content.trim()
    if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/```(json)?/g, '').trim()
    }
    try {
        docContent = JSON.parse(cleanedContent) // parse the LLM response
    } catch (error) {
        console.error('Error parsing LLM generated queries: ', error)
    }
    console.log(`\nGenerated Hypothetical Doc: ${docContent}`)

    // Retrieving Function
    const retrieve = async (state) => {
        const resultsArray = await vectorStore.similaritySearch(state.question,2)
        return {
            context : resultsArray
        }
    }

    // Generate Function
    const generate = async (state) => {
        const docsContent = state.context.map((doc)=>doc.pageContent).join('\n')

        const messages = await promptTemplate.invoke({
            question : question,
            context : docsContent
        })

        const response = await llm.invoke(messages)
        return { answer : response.content}
    }

    // Defining Graph Nodes and Edges
    const graph = new StateGraph(StateAnnotation)
    .addNode('retrieve',retrieve)
    .addNode('generate',generate)
    .addEdge('__start__','retrieve')
    .addEdge('retrieve','generate')
    .addEdge('generate','__end__')
    .compile()

    //  2-, 5-, 8- ,.... Running Graph Stream Here
    let inputs = {
        question : docContent[0]
    }

    console.log('\nQuery : ',chalk.red(question))
    result = await graph.invoke(inputs)
    console.log(
        '\n',
        chalk.bgGreen.bold.black('Final Response : '),
        chalk.bold.greenBright(result['answer'])
    )

    // Logs Entry 
    const logEntry = {
        function : 'Chatbot_HyDE',
        timestamp : new Date().toISOString(),
        website : webUrl,
        originalQuestion : question,
        hypotheticalDoc : docContent[0],
        RESPONSE : result['answer']
    }

    fs.appendFileSync('rag_logs.json',JSON.stringify(logEntry)+'\n')

    // Formatting Logs
    exec('node logsFormatter.js', (error,stdout, stderr)=>{
        if(error){
            console.error(`Error executing script : ${error.message}`)
            return
        }
        if(stderr){
            console.error(`Script Error : ${stderr}`)
            return 
        }
        console.log(`${stdout}`)
    })
    // RETRIEVING PROCESS Done
}
const rl = readline.createInterface({ input, output })
const webUrl = await rl.question(
    chalk.bold.blue`\nEnter the URL of the website: `
)

const question = await rl.question(
    chalk.bold.blue`\nEnter your question: `
)
console.log('\n')
rl.close()
main(webUrl, question)

