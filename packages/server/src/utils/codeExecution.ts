import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { v4 as uuidv4 } from 'uuid'
import logger from './logger'

export enum CodeLanguage {
    JAVASCRIPT = 'javascript',
    PYTHON = 'python',
    TYPESCRIPT = 'typescript'
}

export interface CodeExecutionResult {
    success: boolean
    output?: string
    error?: string
    executionTime: number
}

export interface CodeExecutionOptions {
    timeout?: number // in milliseconds, default 30000 (30 seconds)
    workingDirectory?: string
    environmentVariables?: Record<string, string>
}

class CodeExecutor {
    private readonly tempDir: string
    private readonly defaultTimeout = 30000 // 30 seconds
    private readonly maxTimeout = 300000 // 5 minutes

    constructor() {
        this.tempDir = path.join(os.tmpdir(), 'flowise-code-execution')
        this.ensureTempDirectory()
    }

    private ensureTempDirectory(): void {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true })
        }
    }

    private createTempFile(code: string, language: CodeLanguage): string {
        const fileId = uuidv4()
        let fileName: string
        let fileContent: string = code

        switch (language) {
            case CodeLanguage.JAVASCRIPT:
                fileName = `${fileId}.js`
                break
            case CodeLanguage.PYTHON:
                fileName = `${fileId}.py`
                break
            case CodeLanguage.TYPESCRIPT:
                fileName = `${fileId}.ts`
                // For TypeScript, we'll need to compile it first
                break
            default:
                throw new Error(`Unsupported language: ${language}`)
        }

        const filePath = path.join(this.tempDir, fileName)
        fs.writeFileSync(filePath, fileContent, 'utf8')
        return filePath
    }

    private cleanupTempFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
            }
        } catch (error) {
            logger.warn(`Failed to cleanup temp file ${filePath}:`, error)
        }
    }

    private getExecutionCommand(language: CodeLanguage, filePath: string): { command: string; args: string[] } {
        switch (language) {
            case CodeLanguage.JAVASCRIPT:
                return { command: 'node', args: [filePath] }
            case CodeLanguage.PYTHON:
                return { command: 'python', args: [filePath] }
            case CodeLanguage.TYPESCRIPT:
                // Use ts-node for direct TypeScript execution
                return { command: 'npx', args: ['ts-node', filePath] }
            default:
                throw new Error(`Unsupported language: ${language}`)
        }
    }

    private executeProcess(
        command: string,
        args: string[],
        options: CodeExecutionOptions
    ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
        return new Promise((resolve) => {
            const timeout = Math.min(options.timeout || this.defaultTimeout, this.maxTimeout)
            const workingDir = options.workingDirectory || this.tempDir
            
            const childProcess: ChildProcess = spawn(command, args, {
                cwd: workingDir,
                env: { ...process.env, ...options.environmentVariables },
                stdio: ['pipe', 'pipe', 'pipe']
            })

            let stdout = ''
            let stderr = ''
            let isTimedOut = false

            // Set up timeout
            const timeoutId = setTimeout(() => {
                isTimedOut = true
                childProcess.kill('SIGKILL')
            }, timeout)

            // Collect stdout
            childProcess.stdout?.on('data', (data) => {
                stdout += data.toString()
            })

            // Collect stderr
            childProcess.stderr?.on('data', (data) => {
                stderr += data.toString()
            })

            // Handle process completion
            childProcess.on('close', (exitCode) => {
                clearTimeout(timeoutId)
                
                if (isTimedOut) {
                    resolve({
                        stdout: '',
                        stderr: `Execution timed out after ${timeout}ms`,
                        exitCode: -1
                    })
                } else {
                    resolve({ stdout, stderr, exitCode })
                }
            })

            // Handle process errors
            childProcess.on('error', (error) => {
                clearTimeout(timeoutId)
                resolve({
                    stdout: '',
                    stderr: `Process error: ${error.message}`,
                    exitCode: -1
                })
            })
        })
    }

    async executeCode(
        code: string,
        language: CodeLanguage,
        options: CodeExecutionOptions = {}
    ): Promise<CodeExecutionResult> {
        const startTime = Date.now()
        let tempFilePath: string | null = null

        try {
            // Create temporary file
            tempFilePath = this.createTempFile(code, language)
            
            // Get execution command
            const { command, args } = this.getExecutionCommand(language, tempFilePath)
            
            // Execute the code
            const result = await this.executeProcess(command, args, options)
            const executionTime = Date.now() - startTime

            // Determine success based on exit code and stderr
            const success = result.exitCode === 0 && !result.stderr.trim()
            
            return {
                success,
                output: result.stdout.trim(),
                error: result.stderr.trim() || undefined,
                executionTime
            }
        } catch (error) {
            const executionTime = Date.now() - startTime
            logger.error('Code execution error:', error)
            
            return {
                success: false,
                error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                executionTime
            }
        } finally {
            // Cleanup temporary file
            if (tempFilePath) {
                this.cleanupTempFile(tempFilePath)
            }
        }
    }

    // Method to validate if required runtimes are available
    async validateRuntimes(): Promise<{ [key in CodeLanguage]: boolean }> {
        const results: { [key in CodeLanguage]: boolean } = {
            [CodeLanguage.JAVASCRIPT]: false,
            [CodeLanguage.PYTHON]: false,
            [CodeLanguage.TYPESCRIPT]: false
        }

        // Test Node.js
        try {
            const nodeResult = await this.executeProcess('node', ['--version'], { timeout: 5000 })
            results[CodeLanguage.JAVASCRIPT] = nodeResult.exitCode === 0
        } catch {
            results[CodeLanguage.JAVASCRIPT] = false
        }

        // Test Python
        try {
            const pythonResult = await this.executeProcess('python', ['--version'], { timeout: 5000 })
            results[CodeLanguage.PYTHON] = pythonResult.exitCode === 0
        } catch {
            results[CodeLanguage.PYTHON] = false
        }

        // Test TypeScript (ts-node)
        try {
            const tsResult = await this.executeProcess('npx', ['ts-node', '--version'], { timeout: 10000 })
            results[CodeLanguage.TYPESCRIPT] = tsResult.exitCode === 0
        } catch {
            results[CodeLanguage.TYPESCRIPT] = false
        }

        return results
    }
}

// Export singleton instance
export const codeExecutor = new CodeExecutor()

// Convenience function for direct usage
export const executeCode = async (
    code: string,
    language: CodeLanguage,
    options?: CodeExecutionOptions
): Promise<CodeExecutionResult> => {
    return codeExecutor.executeCode(code, language, options)
}

// Function to check runtime availability
export const checkRuntimeAvailability = async (): Promise<{ [key in CodeLanguage]: boolean }> => {
    return codeExecutor.validateRuntimes()
}