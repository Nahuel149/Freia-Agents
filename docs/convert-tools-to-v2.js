const fs = require('fs');
const path = require('path');

// Tool JSON files to convert
const toolFiles = [
    'inventory-tools.json',
    'customer-management-tools.json', 
    'outbound-contact-tools.json',
    'promotional-system-tools.json',
    'sales-flow-tools.json'
];

// Load the current V2 chatflow
const chatflowPath = 'c:/Users/nahue/Desktop/Freia/docs/ChatFlowAgentv2.0.json';
const chatflow = JSON.parse(fs.readFileSync(chatflowPath, 'utf8'));

let nodeCounter = 10; // Start from 10 to avoid conflicts with existing nodes
let yPosition = 3000; // Start positioning new nodes below existing ones

// Function to create HTTP GET node
function createHttpGetNode(tool, index) {
    const nodeId = `httpRequestGet_${nodeCounter++}`;
    
    return {
        id: nodeId,
        position: {
            x: 100 + (index % 4) * 350,
            y: yPosition + Math.floor(index / 4) * 600
        },
        type: "customNode",
        data: {
            id: nodeId,
            label: tool.name,
            version: 2,
            name: "httpRequestGet",
            type: "HttpRequestGet",
            baseClasses: ["HttpRequestGet", "Tool", "StructuredTool"],
            category: "Tools",
            description: tool.description,
            inputParams: [
                {
                    label: "URL",
                    name: "url",
                    type: "string",
                    description: "HTTP endpoint to be called",
                    placeholder: "https://api.example.com/data",
                    id: `${nodeId}-input-url-string`
                },
                {
                    label: "Description", 
                    name: "description",
                    type: "string",
                    rows: 4,
                    default: "A tool for getting data from an API",
                    description: "Description of when to use this tool",
                    id: `${nodeId}-input-description-string`
                },
                {
                    label: "Headers",
                    name: "headers", 
                    type: "json",
                    description: "HTTP headers to be sent with the request",
                    additionalParams: true,
                    optional: true,
                    id: `${nodeId}-input-headers-json`
                },
                {
                    label: "Query Parameters",
                    name: "queryParams",
                    type: "json", 
                    description: "Query parameters to be sent with the request",
                    additionalParams: true,
                    optional: true,
                    id: `${nodeId}-input-queryParams-json`
                }
            ],
            inputAnchors: [],
            inputs: {
                url: tool.url,
                description: tool.description,
                headers: JSON.stringify(tool.headers || {}),
                queryParams: JSON.stringify(tool.queryParams || {})
            },
            outputAnchors: [
                {
                    id: `${nodeId}-output-httpRequestGet-HttpRequestGet`,
                    name: "httpRequestGet",
                    label: "HttpRequestGet", 
                    description: tool.description,
                    type: "HttpRequestGet"
                }
            ],
            outputs: {},
            selected: false
        },
        width: 300,
        height: 529,
        selected: false,
        positionAbsolute: {
            x: 100 + (index % 4) * 350,
            y: yPosition + Math.floor(index / 4) * 600
        },
        dragging: false
    };
}

// Function to create HTTP POST node
function createHttpPostNode(tool, index) {
    const nodeId = `httpRequestPost_${nodeCounter++}`;
    
    return {
        id: nodeId,
        position: {
            x: 100 + (index % 4) * 350,
            y: yPosition + Math.floor(index / 4) * 600
        },
        type: "customNode",
        data: {
            id: nodeId,
            label: tool.name,
            version: 2,
            name: "httpRequestPost",
            type: "HttpRequestPost",
            baseClasses: ["HttpRequestPost", "Tool", "StructuredTool"],
            category: "Tools",
            description: tool.description,
            inputParams: [
                {
                    label: "URL",
                    name: "url",
                    type: "string",
                    description: "HTTP endpoint to be called",
                    placeholder: "https://api.example.com/data",
                    id: `${nodeId}-input-url-string`
                },
                {
                    label: "Body",
                    name: "body",
                    type: "string",
                    rows: 4,
                    placeholder: "{\"key\": \"value\"}",
                    description: "JSON body of the request",
                    id: `${nodeId}-input-body-string`
                },
                {
                    label: "Description",
                    name: "description", 
                    type: "string",
                    rows: 4,
                    default: "A tool for posting data to an API",
                    description: "Description of when to use this tool",
                    id: `${nodeId}-input-description-string`
                },
                {
                    label: "Headers",
                    name: "headers",
                    type: "json",
                    description: "HTTP headers to be sent with the request", 
                    additionalParams: true,
                    optional: true,
                    id: `${nodeId}-input-headers-json`
                }
            ],
            inputAnchors: [],
            inputs: {
                url: tool.url,
                body: JSON.stringify(tool.body || {}),
                description: tool.description,
                headers: JSON.stringify(tool.headers || {})
            },
            outputAnchors: [
                {
                    id: `${nodeId}-output-httpRequestPost-HttpRequestPost`,
                    name: "httpRequestPost",
                    label: "HttpRequestPost",
                    description: tool.description,
                    type: "HttpRequestPost"
                }
            ],
            outputs: {},
            selected: false
        },
        width: 300,
        height: 529,
        selected: false,
        positionAbsolute: {
            x: 100 + (index % 4) * 350,
            y: yPosition + Math.floor(index / 4) * 600
        },
        dragging: false
    };
}

// Function to create edge connecting tool to agent
function createToolEdge(toolNodeId, toolType) {
    return {
        source: toolNodeId,
        sourceHandle: `${toolNodeId}-output-${toolType}-${toolType.charAt(0).toUpperCase() + toolType.slice(1)}`,
        target: "toolAgent_0",
        targetHandle: "toolAgent_0-input-tools-Tool",
        type: "buttonedge",
        id: `${toolNodeId}-${toolNodeId}-output-${toolType}-${toolType.charAt(0).toUpperCase() + toolType.slice(1)}-toolAgent_0-toolAgent_0-input-tools-Tool`
    };
}

// Process each tool file
let allNewNodes = [];
let allNewEdges = [];
let globalIndex = 0;

for (const toolFile of toolFiles) {
    const toolPath = path.join('c:/Users/nahue/Desktop/Freia/docs', toolFile);
    
    if (!fs.existsSync(toolPath)) {
        console.log(`Warning: ${toolFile} not found, skipping...`);
        continue;
    }
    
    const toolData = JSON.parse(fs.readFileSync(toolPath, 'utf8'));
    const toolsArray = Object.values(toolData)[0]; // Get the first array property
    
    console.log(`Processing ${toolFile} with ${toolsArray.length} tools...`);
    
    for (const tool of toolsArray) {
        let newNode;
        let toolType;
        
        if (tool.type === 'HttpRequestGet') {
            newNode = createHttpGetNode(tool, globalIndex);
            toolType = 'httpRequestGet';
        } else if (tool.type === 'HttpRequestPost') {
            newNode = createHttpPostNode(tool, globalIndex);
            toolType = 'httpRequestPost';
        } else {
            console.log(`Skipping unsupported tool type: ${tool.type}`);
            continue;
        }
        
        allNewNodes.push(newNode);
        allNewEdges.push(createToolEdge(newNode.id, toolType));
        globalIndex++;
    }
    
    yPosition += 800; // Move to next row for next file's tools
}

// Add new nodes and edges to chatflow
chatflow.nodes = chatflow.nodes.concat(allNewNodes);
chatflow.edges = chatflow.edges.concat(allNewEdges);

// Save the updated chatflow
const outputPath = 'c:/Users/nahue/Desktop/Freia/docs/ChatFlowAgentv2.0-with-tools.json';
fs.writeFileSync(outputPath, JSON.stringify(chatflow, null, 2));

console.log(`\n✅ Conversion completed!`);
console.log(`📊 Added ${allNewNodes.length} tool nodes and ${allNewEdges.length} connections`);
console.log(`💾 Updated chatflow saved to: ${outputPath}`);
console.log(`\n📋 Summary:`);
console.log(`- Original nodes: ${chatflow.nodes.length - allNewNodes.length}`);
console.log(`- New tool nodes: ${allNewNodes.length}`);
console.log(`- Total nodes: ${chatflow.nodes.length}`);
console.log(`- Total edges: ${chatflow.edges.length}`);
console.log(`\n🔄 Next steps:`);
console.log(`1. Import the new chatflow file: ChatFlowAgentv2.0-with-tools.json`);
console.log(`2. Test the agent with tool functionality`);
console.log(`3. Replace the original file if everything works correctly`);