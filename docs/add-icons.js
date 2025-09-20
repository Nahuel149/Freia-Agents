const fs = require('fs');
const path = require('path');

// Path to the constants file
const constantsPath = '../packages/ui/src/store/constant.js';
const chatflowPath = './ChatFlowAgentv2.0-configured.json';

// Read the constants file
let constantsContent = fs.readFileSync(constantsPath, 'utf8');

// Define HTTP node icons to add to AGENTFLOW_ICONS
const httpNodeIcons = `    {
        name: 'httpRequestGet',
        icon: IconSearch,
        color: '#4CAF50'
    },
    {
        name: 'httpRequestPost',
        icon: IconSend,
        color: '#2196F3'
    },
    {
        name: 'httpRequestPut',
        icon: IconEdit,
        color: '#FF9800'
    },
    {
        name: 'httpRequestDelete',
        icon: IconTrash,
        color: '#F44336'
    },
    {
        name: 'httpRequestPatch',
        icon: IconTool,
        color: '#9C27B0'
    },`;

// Check if HTTP icons are already added
if (!constantsContent.includes('httpRequestGet')) {
    // Add the required imports
    const importSection = constantsContent.match(/import\s*{[^}]+}\s*from\s*'@tabler\/icons-react'/);
    if (importSection) {
        const currentImports = importSection[0];
        const newImports = currentImports.replace(
            '} from \'@tabler/icons-react\'',
            ',\n    IconSearch,\n    IconSend,\n    IconEdit,\n    IconTrash,\n    IconTool\n} from \'@tabler/icons-react\''
        );
        constantsContent = constantsContent.replace(currentImports, newImports);
    }

    // Add the HTTP node definitions before the closing bracket of AGENTFLOW_ICONS
    const agentflowIconsEnd = constantsContent.lastIndexOf(']');
    if (agentflowIconsEnd !== -1) {
        constantsContent = constantsContent.slice(0, agentflowIconsEnd) + 
            httpNodeIcons + '\n' + 
            constantsContent.slice(agentflowIconsEnd);
    }

    // Write the updated constants file
    fs.writeFileSync(constantsPath, constantsContent);
    console.log('✅ Added HTTP node icons to AGENTFLOW_ICONS array');
} else {
    console.log('ℹ️  HTTP node icons already exist in AGENTFLOW_ICONS');
}

// Now remove any emoji icons from the chatflow JSON file
if (fs.existsSync(chatflowPath)) {
    const chatflowData = JSON.parse(fs.readFileSync(chatflowPath, 'utf8'));
    let removedCount = 0;

    // Remove emoji icons from nodes
    chatflowData.nodes.forEach(node => {
        if (node.data && node.data.icon && typeof node.data.icon === 'string') {
            // Remove emoji icons (they should be handled by AGENTFLOW_ICONS now)
            delete node.data.icon;
            removedCount++;
        }
    });

    if (removedCount > 0) {
        fs.writeFileSync(chatflowPath, JSON.stringify(chatflowData, null, 2));
        console.log(`✅ Removed ${removedCount} emoji icons from chatflow (will use proper Tabler icons now)`);
    } else {
        console.log('ℹ️  No emoji icons found to remove from chatflow');
    }
}

console.log('\n🎉 Icon fix complete! HTTP nodes will now display proper Tabler icons instead of broken emojis.');
console.log('💡 The icons are now defined in the AGENTFLOW_ICONS array and will be automatically rendered by the UI.');