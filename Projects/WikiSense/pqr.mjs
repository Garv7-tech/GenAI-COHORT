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

dotenv.config()

async function main(webUrl, question) {
    // Setup LLM
    const llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash',
        temperature: 0
    })

    // Setup embeddings model
    const embeddings = new GoogleGenerativeAIEmbeddings({
        model: 'text-embedding-004'
    })

    // Setup vector store
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
            url: process.env.QDRANT_URL,
            collectionName: 'parallel-query-retrieval'
        }
    )

    // INDEXING
    const spinnerIndex = ora('Indexing Process...\n').start()

    try {
        // Document loading using cheerio
        const pTagSelector = 'p'
        const cheerioLoader = new CheerioWebBaseLoader(webUrl, {
            selector: pTagSelector
        })

        const docsRaw = await cheerioLoader.load()

        // Patch: add metadata {source: url}
        const docs = docsRaw.map(doc => ({
            pageContent: doc.pageContent,
            metadata: { source: webUrl }
        }))

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
        })

        const allSplits = await splitter.splitDocuments(docs)

        const spinnerDocs = ora('Adding documents (chunks) to vector store').start()

        try {
            await vectorStore.addDocuments(allSplits)
            spinnerDocs.succeed('Documents (Chunks) added to vector store')
        } catch (error) {
            console.error(`Error adding documents to vector store: ${error}`)
            spinnerDocs.fail('Failed to add documents to vector store.')
        }

        spinnerIndex.succeed('Indexing Process Done')
    } catch (error) {
        console.error('Error indexing documents : ', error)
        spinnerIndex.fail('Failed to index documents.')
    }

    // RETRIEVING
    const promptTemplate = await pull('rlm/rag-prompt')

    const StateAnnotation = Annotation.Root({
        question: Annotation,
        context: Annotation,
        answer: Annotation,
    })

    const retrieve = async (state) => {
        const baseQuestion = state.question

        const queryGeneratorPrompt = `Generate 3 different but related search queries based on this question : \n"${baseQuestion}". Respond ONLY with a raw JSON array, no explanation, no code block, no backtick. Example : ["query1", "query2", "query3"]`

        const queryResponse = await llm.invoke(queryGeneratorPrompt)

        let queryVariations
        try {
            queryVariations = JSON.parse(queryResponse.content)
            if (!Array.isArray(queryVariations)) {
                throw new Error('LLM response is not an array')
            }
        } catch (error) {
            console.error(`Error parsing LLM generated queries : ${error}`)
            queryVariations = [baseQuestion]
        }
        console.log(chalk.bold.magenta(`\nQuery Variations : ${queryVariations}`))

        const retrievalPromises = queryVariations.map((query) => {
            return vectorStore.similaritySearch(query, 2)
        })

        const resultsArrays = await Promise.all(retrievalPromises)

        const allResults = resultsArrays.flat()

        const uniqueResults = Array.from(
            new Map(
                allResults.map((doc) => [
                    (doc.metadata && doc.metadata.source) || doc.pageContent.slice(0, 30),
                    doc
                ])
            ).values()
        )

        // Optional: show retrieved chunks for debugging
        console.log(chalk.yellow(`\nRetrieved ${uniqueResults.length} chunks:`))
        uniqueResults.forEach((doc, index) => {
            console.log(
                chalk.gray(`\n--- Chunk #${index + 1} ---\n`) +
                chalk.white(doc.pageContent.slice(0, 500)) + '...'
            )
        })

        return { context: uniqueResults }
    }

    const generate = async (state) => {
        const docsContent = state.context.map((doc) => doc.pageContent).join('\n')

        const messages = await promptTemplate.invoke({
            question: state.question,
            context: docsContent
        })

        const response = await llm.invoke(messages)
        return { answer: response.content }
    }

    // Control Flow
    const graph = new StateGraph(StateAnnotation)
        .addNode('retrieve', retrieve)
        .addNode('generate', generate)
        .addEdge('__start__', 'retrieve')
        .addEdge('retrieve', 'generate')
        .addEdge('generate', '__end__')
        .compile()

    const inputs = {
        question: question
    }

    const spinnerStream = ora('Calling graph.stream()').start()

    try {
        const result = await graph.invoke(inputs)
        console.log('\n')
        console.log('\nAnswer: ' + chalk.bold.greenBright`${result['answer']}`)
        spinnerStream.succeed('Response Retrieved')
    } catch (error) {
        console.error(`Error calling graph.stream(): ${error}`)
        spinnerStream.fail('Failed to Retrieve.')
    }
}

const rl = readline.createInterface({ input, output })

const webUrl = await rl.question(
    chalk.bold.blue`\nEnter the URL of the website: `
)

const question = await rl.question(chalk.bold.blue`\nEnter your question: `)
console.log('\n')
rl.close()

main(webUrl, question)



