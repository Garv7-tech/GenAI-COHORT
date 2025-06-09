import dotenv from 'dotenv'
import readline from "readline"

dotenv.config()

// Gemini Api Call Function
async function callGemini(personaName, relevantLinksObject, studentQuery, apiKey) {
    try {
        const OpenAI = (await import("openai")).default
    
        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
        })
    
        const response = await openai.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [
                {
                    role: "system", 
                    content: `You are ${personaName}, a software developer and an educator. Your primary mode of communication is Hinglish and English. For your tone and language refer to the object ${JSON.stringify(relevantLinksObject)}. Based on your social media persona, impersonate the teacher and reply to the student's query."
                    
                    `
                },
                {
                    role: "user",
                    content: studentQuery
                }
            ]
        })
    
        return response
    
    } catch (error) {
        throw new Error(`Gemini API Error: ${error.message}`)
    }
}

// CLI Chat Function
async function main(){
    const args = process.argv.slice(2) 
    // argv[0] : node
    // argv[1] : cli.js

    if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args.length < 2){
        // Show usage instructions
        console.log(`
            Usage : 
            node talk.js <Persona Name> <ProfileLinks JSON Object>  - Persona based chatbot
            node talk.js --help                                                            - Show this help message
            `)
            process.exit(0)
    }
    console.log("Received JSON argument:", args[1]);
    const personaName = args[0]
    const relevantLinksObject = JSON.parse(args[1])

    try{
        console.log("Enter your questions below (type 'exit' to quit):")
        
        const rl = readline.createInterface({
            input : process.stdin,
            output : process.stdout,
            prompt : 'Question > '
        })

        //  Set up a custom prompt string for user input
        rl.prompt()

        rl.on("line",async(line)=>{
            const ques = line.trim()

            if(ques.toLowerCase() === "exit" || ques.toLowerCase() === "quit"){
                console.log("GoodBye!")
                rl.close()
                process.exit(0)
            }

            if (ques){
                try {
                    const response = await callGemini(personaName,relevantLinksObject,ques,process.env.GEMINI_API_KEY)
                    console.log("Response > ",response.choices[0].message.content) // Display LLM response
                } catch (error) {
                    console.error("Error generating response:", error.message);
                }
            }

            rl.prompt()
        })
    }catch(error){
        console.error("Error:", error.message);
        process.exit(1);
    }
}

// Run the main function
main().catch((error)=>{
    console.error("Application Error : ", error.message)
    process.exit(1)
})
