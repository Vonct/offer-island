import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';import {dirname,join} from 'node:path';import {homedir} from 'node:os';
import {emptyState,applyCommand} from '../web/core/model.mjs';
export const defaultPath=()=>process.env.OFFER_DB||join(homedir(),'Library','Application Support','Offer Island','offer.sqlite');
export function openStore(path=defaultPath()){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});const db=new DatabaseSync(path,{timeout:5000});db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)');db.prepare('INSERT OR IGNORE INTO state VALUES(1,?)').run(JSON.stringify(emptyState()));
 const read=()=>JSON.parse(db.prepare('SELECT data FROM state WHERE id=1').get().data);
 return {read,close:()=>db.close(),dispatch(command,expected){db.exec('BEGIN IMMEDIATE');try{const old=read();if(expected!==undefined&&expected!==old.revision){const e=Error('数据已被其他窗口或 Agent 更新，请重新打开编辑。');e.status=409;e.state=old;throw e;}const next=applyCommand(old,command);db.prepare('UPDATE state SET data=? WHERE id=1').run(JSON.stringify(next));db.exec('COMMIT');return next}catch(e){db.exec('ROLLBACK');throw e}}};
}
