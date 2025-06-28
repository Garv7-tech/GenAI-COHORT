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
import { all } from 'abort-controller-x'

dotenv.config()

async function main(webUrl, question) {
    // INSTANTIATION PROCESS Starts

    let llm
    let vectorStore
    try {
        const spinnerInstantiate = ora('Instantiation... \n').start()
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
        vectorStore = await QdrantVectorStore.fromExistingCollection(
            embeddings,
            {
                url: process.env.QDRANT_URL,
                collectionName: 'reciprocal-rank-fusion'
            }
        )

        spinnerInstantiate.succeed('Instantiation Done.\n')
    } catch (error) {
        console.error(`Error during instantiation : ${error}`)
        spinnerInstantiate.fail('Failed to instantiate. \n')
    }

    // INSTANTIATION PROCESS Done

    // INDEXING PROCESS Starts

    const spinnerIndex = ora('Indexing Process... \n').start()

    try {
        // Document loading using cheerio
        const pTagSelector = 'p'
        const cheerioLoader = new CheerioWebBaseLoader(webUrl, {
            selector: pTagSelector
        })

        const docs = await cheerioLoader.load()

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
        })

        const allSplits = await splitter.splitDocuments(docs)

        // Storing chunks in vector store
        const spinnerDocs = ora('Adding documents (Chunks) to vector store.').start()

        try {
            await vectorStore.addDocuments(allSplits)

            spinnerDocs.succeed('Documents (Chunks) added to vector store. \n')
        } catch (error) {
            console.log(`Error loading documents: ${error}`)

            spinnerDocs.fail(`Failed to index documents`)
        }
        spinnerIndex.succeed('Indexing Process Done.')
    } catch (error) {
        console.log(`Error Indexing Documents : ${error}`)
        spinnerIndex.fail(`Failed to index documents`)
    }

    // INDEXING PROCESS DONE

    // RETRIEVING Starts
    const promptTemplate = await pull('rlm/rag-prompt')

    // USING LANGGRAPH TO WRAP EVERYTHING INSIDE ONE FLOW

    const InputStateAnnotation = Annotation.Root({
        question: Annotation
    })

    const StateAnnotation = Annotation.Root({
        question: Annotation,
        context: Annotation,
        answer: Annotation
    })

    // RRF Based Retrieval Function
    const retrieve = async (state) => {
        const baseQuestion = state.question
        const queryGeneratorPrompt = `
        Generate 3 different but related search queries based on this question:\n "${baseQuestion}"
        Respond ONLY with a raw JSON array, no explanation, no code block, no backticks. Example : ["query1","query2","query3"]
        `

        const queryResponse = await llm.invoke(queryGeneratorPrompt)
        let queryVariations

        try {
            queryVariations = JSON.parse(queryResponse.content)
        } catch (error) {
            console.log('Error parsing LLM generated queries: ', error)
            return
        }

        console.log(`\nLLM generated queries : ${queryVariations}`)

        const retrievalPromises = queryVariations.map((query) => vectorStore.similaritySearch(query, 2))

        const resultsArrays = await Promise.all(retrievalPromises)


        const prioritizedResults = reciprocalRankFusion(resultsArrays).top(4)

        console.log('\nPrioritized results after RF:\n', prioritizedResults)
        return { context: prioritizedResults }
    }

    const reciprocalRankFusion = (resultsArrays, k = 60) => {
        const scores = new Map() // to storethe total score for each document
        const docMap = new Map() // to store actual doc references

        // Loop through each query's result list
        // *rank* is the document's position to that particular list
        resultsArrays.forEach((resultsFromOneQuery) => {
            resultsFromOneQuery.forEach((doc, rank) => {
                // Get the unique id for the document - either from the source URL or from the content
                const docId = doc.metadata?.source || doc.pageContent

                // Score based on rank in this specific list
                // Higher ranked documents get higher scores
                // *k* is a damping factor (set to 60) to keep scores in a reasonable range
                const score = 1 / (k + rank + 1)

                scores.set(docId, (scores.get(docId) || 0) + score) // If the document appeared in another list,its score is added
                docMap.set(docId, doc) // Store the document itself in docMap for final retrieval
            })
        })

        // Sort the documents by their total RRF scores - the document with the highest score comes first
        const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])

        return {
            top: (n) => sorted.slice(0, n).map(([docId]) => docMap.get(docId))
        }
    } // For dry run see this : https://chatgpt.com/s/t_685d4fbb86e8819180852d37a532aa1f

    // GENERATION PROCESS

    // Generating response from Context and User Query (Original)
    const generate = async (state) => {
        const docsContent = state.context.map((doc) => doc.pageContent).join('\n')

        const messages = await promptTemplate.invoke({
            question: state.question,
            context: docsContent
        })

        const response = await llm.invoke(messages)
        return { answer: response.content }
    }

    // DEFINING CONTROL FLOW

    const graph = new StateGraph(StateAnnotation)
    .addNode('retrieve',retrieve)
    .addNode('generate',generate)
    .addEdge('__start__','retrieve')
    .addEdge('retrieve','generate')
    .addEdge('generate','__end__')
    .compile()

    let inputs = {
        question : question
    }

    const spinnerStream = ora('Calling graph.stream()...\n').start()
    try {
        const result = await graph.invoke(inputs)
        console.log('\n')
        console.log('\nAnswer: ' + chalk.bold.greenBright(`${result['answer']}`))
        spinnerStream.succeed('Response Retrieved.')
    } catch (error) {
        console.log('Error calling graph.stream() :', error)
        spinnerStream.fail('Failed to Retrieve. \n')
    }
}

const rl = readline.createInterface({ input, output })

const webUrl = await rl.question(
    chalk.bold.blue('\nEnter the URL of the website: ')
)

const question = await rl.question(chalk.bold.blue('\nEnter your question: '))
console.log('\n')
rl.close()
main(webUrl, question)