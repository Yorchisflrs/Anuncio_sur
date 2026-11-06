import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { defaultConfig } from '../backend/src/config.mjs';
import { openDatabase } from '../backend/src/database.mjs';

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || process.argv.slice(3).some(arg=>arg!=='--crear')) {
  console.error('Uso: node scripts/admin-user.mjs correo@dominio.com [--crear]');
  process.exit(1);
}
function secret(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('La contraseña se solicita solamente en una terminal interactiva; no la escribas como argumento.');
  return new Promise((resolve,reject)=>{
    let value='';readline.emitKeypressEvents(process.stdin);process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
    const finish=()=>{process.stdin.setRawMode(false);process.stdin.removeListener('keypress',onKey);process.stdin.pause();process.stdout.write('\n');};
    const onKey=(input,key)=>{
      if(key?.ctrl&&key.name==='c'){finish();reject(new Error('Operación cancelada.'));return;}
      if(key?.name==='return'){finish();resolve(value);return;}
      if(key?.name==='backspace'){value=value.slice(0,-1);return;}
      if(input&&!key?.ctrl&&!key?.meta&&!/[\x00-\x1f\x7f]/.test(input))value+=input;
    };
    process.stdin.on('keypress',onKey);
  });
}
let db;
try {
  db=await openDatabase({...defaultConfig,seed:false});
  let user=await db.get('SELECT * FROM usuarios WHERE correo=?',email);
  if (user?.es_demo) throw new Error('Una cuenta pública de demostración no puede convertirse en administradora. Crea una cuenta personal.');
  if (!user) {
    if(!process.argv.includes('--crear'))throw new Error('No existe ese correo. Regístralo primero o utiliza --crear para solicitar sus datos de forma interactiva.');
    const terminal=createInterface({input:process.stdin,output:process.stdout});
    const phone=(await terminal.question('Celular peruano (9 dígitos): ')).trim();terminal.close();
    if(!/^9\d{8}$/.test(phone))throw new Error('El celular debe tener nueve dígitos y comenzar con 9.');
    const password=await secret('Contraseña (no se mostrará): '),confirmation=await secret('Repite la contraseña: ');
    if(password!==confirmation||password.length<12||Buffer.byteLength(password,'utf8')>72)throw new Error('Usa contraseñas iguales de al menos 12 caracteres y hasta 72 bytes.');
    const result=await db.run("INSERT INTO usuarios(correo,celular,password_hash,rol,fecha_registro) VALUES(?,?,?,'admin',?)",email,phone,await bcrypt.hash(password,12),new Date().toISOString());
    user={id:result.lastInsertRowid};
  } else await db.run("UPDATE usuarios SET rol='admin' WHERE id=?",user.id);
  console.log(`Administrador configurado para ${email}. No se modificaron anuncios ni pagos.`);
} catch(error) { console.error(error.message);process.exitCode=1; }
finally { if(db)await db.close(); }
