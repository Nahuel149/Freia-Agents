const fs = require('fs');

// Configuration - Using your Render deployment URL
const API_BASE_URL = 'https://freia-agents.onrender.com'; // Your Render deployment URL
const API_KEY = 'freia-api-key-2024'; // API key for your Freia backend

const inputFile = 'ChatFlowAgentv2.0-with-tools.json';
const outputFile = 'ChatFlowAgentv2.0-configured.json';

try {
    console.log('🔧 Actualizando URLs de API...');
    
    // Leer el archivo
    const chatflowData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    
    // Convertir a string para hacer reemplazos globales
    let chatflowString = JSON.stringify(chatflowData, null, 2);
    
    // Reemplazar las variables
    chatflowString = chatflowString.replace(/\$\{FREIA_API_BASE_URL\}/g, API_BASE_URL);
    chatflowString = chatflowString.replace(/\$\{FREIA_API_KEY\}/g, API_KEY);
    
    // Guardar el archivo actualizado
    fs.writeFileSync(outputFile, chatflowString);
    
    console.log('✅ URLs actualizadas correctamente!');
    console.log(`📁 Archivo guardado como: ${outputFile}`);
    console.log(`🔗 API Base URL: ${API_BASE_URL}`);
    console.log('🔑 API Key: [CONFIGURADA]');
    
} catch (error) {
    console.error('❌ Error:', error.message);
}