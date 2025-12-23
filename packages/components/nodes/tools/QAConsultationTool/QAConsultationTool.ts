import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'
import { DynamicStructuredTool } from '../CustomTool/core'
import { z } from 'zod'

class QAConsultationTool_Tools implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]

    constructor() {
        this.label = 'QA Consultation Tool'
        this.name = 'qaConsultationTool'
        this.version = 1.0
        this.type = 'QAConsultationTool'
        this.icon = 'qa-tool.svg'
        this.category = 'Tools'
        this.description = 'Custom tool for document consultation using Conversational Retrieval QA Chain'
        this.baseClasses = [this.type, 'Tool', ...getBaseClasses(DynamicStructuredTool)]
        this.inputs = [
            {
                label: 'QA Chain',
                name: 'qaChain',
                type: 'ConversationalRetrievalQAChain',
                description: 'Conversational Retrieval QA Chain for document consultation'
            },
            {
                label: 'Tool Name',
                name: 'toolName',
                type: 'string',
                default: 'document_consultation',
                description: 'Name of the tool'
            },
            {
                label: 'Tool Description',
                name: 'toolDescription',
                type: 'string',
                default: 'Consult documents to answer questions based on stored knowledge',
                description: 'Description of what the tool does'
            },
            {
                label: 'Return Direct',
                name: 'returnDirect',
                type: 'boolean',
                optional: true,
                description: 'Return the output of the tool directly to the user'
            }
        ]
    }

    async init(nodeData: INodeData): Promise<DynamicStructuredTool> {
        const qaChain = nodeData.inputs?.qaChain
        const toolName = (nodeData.inputs?.toolName as string) || 'document_consultation'
        const toolDescription =
            (nodeData.inputs?.toolDescription as string) || 'Consult documents to answer questions based on stored knowledge'
        const returnDirect = nodeData.inputs?.returnDirect as boolean

        if (!qaChain) {
            throw new Error('QA Chain is required')
        }

        // Define the Zod schema for the tool input
        const schema = z.object({
            question: z.string().describe('The question to ask about the documents')
        })

        // Define the function that will be executed
        const code = `
            async function executeFunction(input, variables) {
                const { question } = input;
                const { qaChain } = variables;
                
                if (!qaChain) {
                    throw new Error('QA Chain not available');
                }
                
                try {
                    // Call the QA chain with the question
                    const result = await qaChain.call({
                        question: question,
                        chat_history: []
                    });
                    
                    return result.text || result.answer || JSON.stringify(result);
                } catch (error) {
                    console.error('Error in QA consultation:', error);
                    return 'I apologize, but I encountered an error while trying to consult the documents. Please try rephrasing your question.';
                }
            }
            
            return await executeFunction(input, variables);
        `

        // Create the dynamic structured tool
        const tool = new DynamicStructuredTool({
            name: toolName,
            description: toolDescription,
            schema,
            code
        })

        // Set the QA chain as a variable
        tool.setVariables([{ qaChain }])

        if (returnDirect !== undefined) {
            tool.returnDirect = returnDirect
        }

        return tool
    }
}

module.exports = { nodeClass: QAConsultationTool_Tools }
