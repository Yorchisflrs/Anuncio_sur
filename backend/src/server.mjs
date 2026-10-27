import { createApp } from './app.mjs';

const { app, db } = await createApp();
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => console.log('AvisoSur API y aplicación: http://' + host + ':' + port));
server.on('error', async error => { console.error('No se pudo iniciar el servidor:', error.message); await db.close(); process.exit(1); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await db.close(); process.exit(0); }));
