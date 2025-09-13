/**                                                                                                                                                                
   * B2B Corporate Sales AI (V3) – El Rutero Experto                                                                                                                 
   * Language: JavaScript (Node)                                                                                                                                     
   * Supports:                                                                                                                                                       
   * - LOAD_DATA { manual, clientes, productos, ventas }                                                                                                             
   * - CONFIRMAR_COMPRA client:<id|email|name> product:<code> qty:<n> price:<ars>                                                                                    
   * - FEEDBACK score:<0-10> notes:<text>                                                                                                                            
   * Emits events used by the analytics pipeline and dashboard.                                                                                                      
   */                                                                                                                                                                
                                                                                                                                                                     
  const fs = require('fs')                                                                                                                                           
  const os = require('os')                                                                                                                                           
  const path = require('path')                                                                                                                                       
  const DATA_FILE = path.join(os.tmpdir(), 'b2b_el_rutero_experto_data.json')                                                                                        
                                                                                                                                                                     
  function loadState() {                                                                                                                                             
    try {                                                                                                                                                            
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))                                                                                                          
    } catch {                                                                                                                                                        
      return {}                                                                                                                                                      
    }                                                                                                                                                                
  }                                                                                                                                                                  
  function saveState(s) {                                                                                                                                            
    fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 2), 'utf8')                                                                                                  
  }                                                                                                                                                                  
  function isJsonString(s) {                                                                                                                                         
    try {                                                                                                                                                            
      JSON.parse(s)                                                                                                                                                  
      return true                                                                                                                                                    
    } catch {                                                                                                                                                        
      return false                                                                                                                                                   
    }                                                                                                                                                                
  }                                                                                                                                                                  
  function toArray(x) {                                                                                                                                              
    return Array.isArray(x) ? x : x ? [x] : []                                                                                                                       
  }                                                                                                                                                                  
  function nowISO() {                                                                                                                                                
    return new Date().toISOString()                                                                                                                                  
  }                                                                                                                                                                  
  function scheduleFollowUp(days = 30, notes = '') {                                                                                                                 
    const d = new Date()                                                                                                                                             
    d.setDate(d.getDate() + days)                                                                                                                                    
    return { ts: d.toISOString(), notes }                                                                                                                            
  }                                                                                                                                                                  
                                                                                                                                                                     
  function extract(_field, text, rx) {                                                                                                                               
    const m = text.match(rx)                                                                                                                                         
    return m ? m[1].trim() : null                                                                                                                                    
  }                                                                                                                                                                  
  function parsePatterns(msg) {                                                                                                                                      
    return {                                                                                                                                                         
      confirm: /^\s*CONFIRMAR_COMPRA/i.test(msg),                                                                                                                    
      feedback: /^\s*FEEDBACK/i.test(msg)                                                                                                                            
    }                                                                                                                                                                
  }                                                                                                                                                                  
  function parseSaleCommand(msg) {                                                                                                                                   
    // CONFIRMAR_COMPRA client:<...> product:<...> qty:<n> price:<ars>                                                                                               
    const client = extract('client', msg, /client\s*:\s*([^\s]+.*?)(?=\s+\w+:|$)/i)                                                                                  
    const product = extract('product', msg, /product\s*:\s*([^\s]+.*?)(?=\s+\w+:|$)/i)                                                                               
    const qty = parseInt(extract('qty', msg, /qty\s*:\s*([0-9]+)/i) || '0', 10)                                                                                      
    const price = parseFloat(extract('price', msg, /price\s*:\s*([0-9]+(?:\.[0-9]+)?)/i) || '0')                                                                     
    return { client, product, qty, price }                                                                                                                           
  }                                                                                                                                                                  
  function parseFeedbackCommand(msg) {                                                                                                                               
    // FEEDBACK score:<0-10> notes:<text...>                                                                                                                         
    const score = parseFloat(extract('score', msg, /score\s*:\s*([0-9]+(?:\.[0-9]+)?)/i) || '0')                                                                     
    const notes = extract('notes', msg, /notes\s*:\s*([\s\S]+)/i) || ''                                                                                              
    return { score, notes }                                                                                                                                          
  }                                                                                                                                                                  
                                                                                                                                                                     
  function findClient(clientes, query) {                                                                                                                             
    if (!clientes) return null                                                                                                                                       
    const q = (query || '').toLowerCase()                                                                                                                            
    let list = clientes.clients || clientes.clientes || clientes                                                                                                     
    list = toArray(list)                                                                                                                                             
    let c =                                                                                                                                                          
      list.find((c) => (c.name || '').toLowerCase() === q) ||                                                                                                        
      list.find((c) => (c.company || '').toLowerCase() === q) ||                                                                                                     
      list.find((c) => (c.email || '').toLowerCase() === q)                                                                                                          
    if (!c)                                                                                                                                                          
      c = list.find(                                                                                                                                                 
        (c) =>                                                                                                                                                       
          (c.name || '').toLowerCase().includes(q) ||                                                                                                                
          (c.company || '').toLowerCase().includes(q) ||                                                                                                             
          (c.email || '').toLowerCase().includes(q)                                                                                                                  
      )                                                                                                                                                              
    return c || null                                                                                                                                                 
  }                                                                                                                                                                  
  function checkStock(productos, productId) {                                                                                                                        
    if (!productos) return null                                                                                                                                      
    const list = productos.products || productos.productos || productos                                                                                              
    const p = toArray(list).find((p) => (p.id || p.product_id) == productId || (p.code || p.product_code) == productId)                                              
    if (!p) return null                                                                                                                                              
    return {                                                                                                                                                         
      id: p.id || p.product_id || p.code,                                                                                                                            
      name: p.name || p.nombre,                                                                                                                                      
      stock: p.stock,                                                                                                                                                
      price: p.price || p.precio,                                                                                                                                    
      brand: p.brand || p.marca                                                                                                                                      
    }                                                                                                                                                                
  }                                                                                                                                                                  
                                                                                                                                                                     
  function lowStockAlerts(productos, threshold = 20) {                                                                                                               
    if (!productos) return []                                                                                                                                        
    const list = productos.products || productos.productos || productos                                                                                              
    return toArray(list).filter((p) => typeof p.stock === 'number' && p.stock < threshold)                                                                           
  }                                                                                                                                                                  
  function objectionHandler(manual, type) {                                                                                                                          
    const m = manual && (manual.objections || manual.objeciones)                                                                                                     
    const price = m && (m.price || m.precio)                                                                                                                         
    const terms = m && (m.payment_terms || m.condiciones_pago)                                                                                                       
    const contract = m && (m.existing_contract || m.contrato_existente)                                                                                              
    switch ((type || '').toLowerCase()) {                                                                                                                            
      case 'price':                                                                                                                                                  
        return (price && price.response) || `Entiendo. Nuestro precio refleja disponibilidad, durabilidad y servicio post-venta. ¿Su proveedor actual le ofrece esa  
  garantía?`                                                                                                                                                         
      case 'payment':                                                                                                                                                
        return (terms && terms.response) || `Podemos evaluar 30/60 días según su historial.`                                                                         
      case 'contract':                                                                                                                                               
        return (contract && contract.response) || `Considérenos proveedor secundario con una compra de prueba.`                                                      
      default:                                                                                                                                                       
        return `Nuestro foco es reducir costo/km, minimizar downtime y asegurar seguridad de su flota.`                                                              
    }                                                                                                                                                                
  }                                                                                                                                                                  
                                                                                                                                                                     
  /**                                                                                                                                                                
   * v2 Autoload: persist FLOWISE_SELECTED_DOCS envelope into state.datasets                                                                                         
   * - Maps kinds -> { productos, clientes, ventas, manual }                                                                                                         
   * - Uses FLOWISE_DATASET_HASH as a soft idempotency hint (stored only).                                                                                           
   */                                                                                                                                                                
  function envAutoloadIntoState(state) {                                                                                                                             
    const raw = process.env.FLOWISE_SELECTED_DOCS                                                                                                                    
    if (!raw) return false                                                                                                                                           
    try {                                                                                                                                                            
      const env = JSON.parse(raw) // { version:'1', stores:[{ id, name, kind, data }, ...] }                                                                         
      state.datasets = state.datasets || {}                                                                                                                          
      for (const s of toArray(env.stores || [])) {                                                                                                                   
        if (s.kind === 'products') state.datasets.productos = s.data                                                                                                 
        else if (s.kind === 'clients') state.datasets.clientes = s.data                                                                                              
        else if (s.kind === 'orders') state.datasets.ventas = s.data                                                                                                 
        else if (s.kind === 'manual') state.datasets.manual = s.data                                                                                                 
      }                                                                                                                                                              
      state.datasetHash = process.env.FLOWISE_DATASET_HASH || state.datasetHash                                                                                      
      saveState(state)                                                                                                                                               
      return true                                                                                                                                                    
    } catch {                                                                                                                                                        
      return false                                                                                                                                                   
    }                                                                                                                                                                
  }                                                                                                                                                                  
                                                                                                                                                                     
  /**                                                                                                                                                                
   * LLM fallback using OpenAI-compatible API                                                                                                                        
   * - Reads env: OPENAI_API_KEY, OPENAI_BASE_URL (optional)                                                                                                         
   * - Uses CODEAGENT_MODEL (default gpt-4o-mini), CODEAGENT_TEMPERATURE (default 0.2)                                                                               
   */                                                                                                                                                                
  async function llmComplete({ system, user }) {                                                                                                                     
    if (!process.env.OPENAI_API_KEY) return ''                                                                                                                       
    try {                                                                                                                                                            
      const OpenAI = (await import('openai')).default                                                                                                                
      const client = new OpenAI({                                                                                                                                    
        apiKey: process.env.OPENAI_API_KEY,                                                                                                                          
        baseURL: process.env.OPENAI_BASE_URL || undefined                                                                                                            
      })                                                                                                                                                             
      const model = process.env.CODEAGENT_MODEL || 'gpt-4o-mini'                                                                                                     
      const temperature = parseFloat(process.env.CODEAGENT_TEMPERATURE || '0.2')                                                                                     
      const resp = await client.chat.completions.create({                                                                                                            
        model,                                                                                                                                                       
        temperature,                                                                                                                                                 
        messages: [                                                                                                                                                  
          { role: 'system', content: system },                                                                                                                       
          { role: 'user', content: user }                                                                                                                            
        ]                                                                                                                                                            
      })                                                                                                                                                             
      const reply = (resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content) || ''                                            
      return reply || ''                                                                                                                                             
    } catch {                                                                                                                                                        
      return ''                                                                                                                                                      
    }                                                                                                                                                                
  }                                                                                                                                                                  
                                                                                                                                                                     
  async function main() {                                                                                                                                            
    let state = loadState()                                                                                                                                          
    state.datasets = state.datasets || {}                                                                                                                            
    const inputRaw = process.env.FLOWISE_INPUT || ''                                                                                                                 
    const events = []                                                                                                                                                
                                                                                                                                                                     
    // v2 Autoload first (no-op if nothing sent)                                                                                                                     
    envAutoloadIntoState(state)                                                                                                                                      
                                                                                                                                                                     
    // LOAD_DATA explicit                                                                                                                                            
    if (/^\s*LOAD_DATA/i.test(inputRaw)) {                                                                                                                           
      const jsonPart = inputRaw.replace(/^\s*LOAD_DATA/i, '').trim()                                                                                                 
      if (!isJsonString(jsonPart)) {                                                                                                                                 
        return JSON.stringify({ reply: 'Formato inválido. Envíe: LOAD_DATA {manual, clientes, productos, ventas}' })                                                 
      }                                                                                                                                                              
      const payload = JSON.parse(jsonPart)                                                                                                                           
      if (payload.manual) state.datasets.manual = payload.manual                                                                                                     
      if (payload.clientes) state.datasets.clientes = payload.clientes                                                                                               
      if (payload.productos) state.datasets.productos = payload.productos                                                                                            
      if (payload.ventas) state.datasets.ventas = payload.ventas                                                                                                     
      saveState(state)                                                                                                                                               
      const alerts = lowStockAlerts(state.datasets.productos, 20)                                                                                                    
      return JSON.stringify({                                                                                                                                        
        reply: `Datos cargados. ${alerts.length ? `Alerta: ${alerts.length} productos con stock bajo.` : ''}`,                                                       
        events: [{ type: 'system', ts: nowISO(), notes: 'Datasets loaded' }],                                                                                        
        datasets: {                                                                                                                                                  
          products:                                                                                                                                                  
            (state.datasets.productos?.products ||                                                                                                                   
              state.datasets.productos?.productos ||                                                                                                                 
              state.datasets.productos) || [],                                                                                                                       
          clients:                                                                                                                                                   
            (state.datasets.clientes?.clients ||                                                                                                                     
              state.datasets.clientes?.clientes ||                                                                                                                   
              state.datasets.clientes) || []                                                                                                                         
        }                                                                                                                                                            
      })                                                                                                                                                             
    }                                                                                                                                                                
                                                                                                                                                                     
    // Require minimal datasets                                                                                                                                      
    if (!state.datasets.manual || !state.datasets.clientes || !state.datasets.productos) {                                                                           
      return JSON.stringify({ reply: 'Cargue primero los JSON con LOAD_DATA { manual, clientes, productos, ventas }' })                                              
    }                                                                                                                                                                
                                                                                                                                                                     
    const manual = state.datasets.manual                                                                                                                             
    const clientes = state.datasets.clientes                                                                                                                         
    const productos = state.datasets.productos                                                                                                                       
    const agentName = (manual.persona && (manual.persona.name || manual.persona.nombre)) || 'Asesor'                                                                 
    const msg = inputRaw.trim()                                                                                                                                      
                                                                                                                                                                     
    // Patterns                                                                                                                                                      
    const patterns = parsePatterns(msg)                                                                                                                              
    if (patterns.confirm) {                                                                                                                                          
      const { client, product, qty, price } = parseSaleCommand(msg)                                                                                                  
      if (!client || !product || !qty || !price) {                                                                                                                   
        return JSON.stringify({                                                                                                                                      
          reply: 'Formato inválido. Use: CONFIRMAR_COMPRA client:<id|email|name> product:<code> qty:<n> price:<ars>'                                                 
        })                                                                                                                                                           
      }                                                                                                                                                              
      const c = findClient(clientes, client) || { id: client, name: client }                                                                                         
      const stock = checkStock(productos, product)                                                                                                                   
      const total = qty * price                                                                                                                                      
      events.push({                                                                                                                                                  
        type: 'sale',                                                                                                                                                
        ts: nowISO(),                                                                                                                                                
        clientId: c.id || c.email || c.name,                                                                                                                         
        clientName: c.name || c.email || 'Cliente',                                                                                                                  
        productId: product,                                                                                                                                          
        qty,                                                                                                                                                         
        amount: total,                                                                                                                                               
        items: [{ productId: product, name: stock?.name || product, qty, price, total }],                                                                            
        totalAmount: total                                                                                                                                           
      })                                                                                                                                                             
      const followUp = scheduleFollowUp(30, 'Revisar rendimiento y stock post compra')                                                                               
      events.push({                                                                                                                                                  
        type: 'follow_up',                                                                                                                                           
        ts: followUp.ts,                                                                                                                                             
        clientId: c.id || c.email || c.name,                                                                                                                         
        clientName: c.name || c.email || 'Cliente',                                                                                                                  
        metadata: { notes: followUp.notes }                                                                                                                          
      })                                                                                                                                                             
      return JSON.stringify({                                                                                                                                        
        reply: `Perfecto. Registré la compra: ${qty} x ${stock?.name || product} por ARS ${total.toLocaleString('es-AR')}. Coordino entrega y facturación. Agendado  
  seguimiento en 30 días.`,                                                                                                                                          
        events,                                                                                                                                                      
        followUp                                                                                                                                                     
      })                                                                                                                                                             
    }                                                                                                                                                                
                                                                                                                                                                     
    if (patterns.feedback) {                                                                                                                                         
      const { score, notes } = parseFeedbackCommand(msg)                                                                                                             
      events.push({ type: 'feedback', ts: nowISO(), metadata: { score, notes } })                                                                                    
      return JSON.stringify({ reply: 'Gracias por su devolución, lo tendremos en cuenta para mejorar.', events })                                                    
    }                                                                                                                                                                
                                                                                                                                                                     
    // Sentiment tagging (very simple)                                                                                                                               
    const sentiment = /excelente|bueno|gracias/i.test(msg)                                                                                                           
      ? 'positive'                                                                                                                                                   
      : /malo|tarde|caro/i.test(msg)                                                                                                                                 
      ? 'negative'                                                                                                                                                   
      : 'neutral'                                                                                                                                                    
    events.push({ type: 'conversation', ts: nowISO(), message: msg, metadata: { sentiment } })                                                                       
                                                                                                                                                                     
    // Objection handling                                                                                                                                            
    if (/competidor.*barat|precio.*alto|caro/i.test(msg)) {                                                                                                          
      return JSON.stringify({ reply: objectionHandler(manual, 'price'), events })                                                                                    
    }                                                                                                                                                                
    if (/pago|plan.*30|60/i.test(msg)) {                                                                                                                             
      return JSON.stringify({ reply: objectionHandler(manual, 'payment'), events })                                                                                  
    }                                                                                                                                                                
    if (/contrato.*otro/i.test(msg)) {                                                                                                                               
      return JSON.stringify({ reply: objectionHandler(manual, 'contract'), events })                                                                                 
    }                                                                                                                                                                
                                                                                                                                                                     
    // LLM main guidance (preferred path)                                                                                                                            
    const system = 'You are a helpful assistant for a tire shop. Be concise.'                                                                                        
    const llmText = await llmComplete({ system, user: msg })                                                                                                         
    if (llmText) {                                                                                                                                                   
      return JSON.stringify({ reply: llmText, events })                                                                                                              
    }                                                                                                                                                                
                                                                                                                                                                     
    // Default guidance (if LLM not configured)                                                                                                                      
    return JSON.stringify({                                                                                                                                          
      reply: `Hola, soy ${agentName} de El Rutero Experto. Trabajo como socio estratégico: reduzco su costo por kilómetro, minimizo downtime y cuido la seguridad.   
  ¿Me confirma tamaño de flota, rubro y desafíos actuales?`,                                                                                                         
      events                                                                                                                                                         
    })                                                                                                                                                               
  }                                                                                                                                                                  
                                                                                                                                                                     
  ;(async () => {                                                                                                                                                    
    process.stdout.write(await main())                                                                                                                               
  })()        