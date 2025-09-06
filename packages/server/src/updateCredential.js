const { Client } = require('pg');

async function updateCredential() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'FreIA.2806',
    database: 'flowise'
  });

  try {
    await client.connect();
    const query = "UPDATE \"user\" SET credential = '$2a$05$O0klnLMTfLJCbBr3wChG4OwBQvOaGizUyE1AmQJRlfNlAjZ1rL1E2' WHERE email = 'admin@freia.ai'";
    const res = await client.query(query);
    console.log('Update successful:', res.rowCount, 'row(s) updated');
  } catch (err) {
    console.error('Error updating credential:', err);
  } finally {
    await client.end();
  }
}

updateCredential();