const { Client } = require('pg');

(async () => {
  try {
    const client = new Client({
      connectionString: 'postgresql://freia_postgres_user:imFxMsDUgcEzDaZqF3wRORrBumZHuwpO@dpg-d2u0qtmr433s73dresng-a.oregon-postgres.render.com/freia_postgres',
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    const hash = '$2a$10$u5hm.o/iLCVR1JnOGy2wB.ZotZa8wxxjFgX6OS.Nl.D4nGuq2CZQC';
    const email = 'admin@freia.ai';
    const update = await client.query('UPDATE "user" SET credential = $1 WHERE email = $2', [hash, email]);
    console.log('Rows updated:', update.rowCount);

    const verify = await client.query('SELECT id, email, credential FROM "user" WHERE email = $1', [email]);
    console.table(verify.rows);

    await client.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();