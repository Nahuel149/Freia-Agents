import { Tool } from '@langchain/core/tools'
import { IUsedTool } from '../../../src/Interface'

/**
 * Validates tool execution order to ensure gomeria_consultation is called first for product queries
 */
export class ToolValidator {
    private static readonly PRODUCT_KEYWORDS = [
        'product',
        'item',
        'buy',
        'purchase',
        'price',
        'cost',
        'catalog',
        'inventory',
        'stock',
        'available',
        'specification',
        'spec',
        'feature',
        'model',
        'brand',
        'category',
        'search',
        'find',
        'recommend',
        'suggestion',
        'compare',
        'review'
    ]

    private static readonly GOMERIA_CONSULTATION_TOOL = 'gomeria_consultation'

    /**
     * Checks if the input query is product-related
     */
    static isProductQuery(input: string): boolean {
        const lowercaseInput = input.toLowerCase()
        return this.PRODUCT_KEYWORDS.some((keyword) => lowercaseInput.includes(keyword))
    }

    /**
     * Checks if gomeria_consultation tool is available in the tools list
     */
    static hasGomeriaConsultationTool(tools: Tool[]): boolean {
        return tools.some((tool) => tool.name === this.GOMERIA_CONSULTATION_TOOL)
    }

    /**
     * Checks if gomeria_consultation has been called in the used tools
     */
    static hasCalledGomeriaConsultation(usedTools: IUsedTool[]): boolean {
        return usedTools.some((tool) => tool.tool === this.GOMERIA_CONSULTATION_TOOL)
    }

    /**
     * Validates if the current tool call is allowed based on the validation rules
     */
    static validateToolCall(
        toolName: string,
        input: string,
        usedTools: IUsedTool[],
        availableTools: Tool[]
    ): { isValid: boolean; reason?: string } {
        // If it's not a product query, allow any tool
        if (!this.isProductQuery(input)) {
            return { isValid: true }
        }

        // If gomeria_consultation is not available, allow any tool (fallback)
        if (!this.hasGomeriaConsultationTool(availableTools)) {
            return { isValid: true }
        }

        // If the tool being called is gomeria_consultation, always allow
        if (toolName === this.GOMERIA_CONSULTATION_TOOL) {
            return { isValid: true }
        }

        // For product queries, check if gomeria_consultation has been called first
        if (!this.hasCalledGomeriaConsultation(usedTools)) {
            return {
                isValid: false,
                reason: `For product-related queries, you must call ${this.GOMERIA_CONSULTATION_TOOL} first to get accurate product information before using other tools.`
            }
        }

        return { isValid: true }
    }

    /**
     * Creates a validation message for the agent when tool validation fails
     */
    static createValidationMessage(reason: string): string {
        return `VALIDATION ERROR: ${reason}\n\nPlease call gomeria_consultation first to get the necessary product information, then proceed with your original request.`
    }
}
