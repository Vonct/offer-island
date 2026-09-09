import {cloudConfig} from './cloud-config.mjs';
import {emptyState,applyCommand,normalizeImport} from './model.mjs';
let client;
export async function getCloud(){
 if(client)return client;
 const {createClient}=await import('../vendor/supabase.mjs');
 return client=createClient(cloudConfig.url,cloudConfig.publishableKey,{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'offer-cloud-session-v1'}
});
}
export function cloudError(error){
 if(/offer_workspaces|offer_save_workspace|schema cache/i.test(error.message||''))return Error('云数据库尚未初始化，请先执行 supabase/setup.sql');
 return Error(error.message||'云端连接失败，请检查网络后重试');
}
export async function readCloud(userId){
 const cloud=await getCloud();
 const {data,error}=await cloud.from('offer_workspaces').select('data').eq('user_id',userId).maybeSingle();
 if(error)throw cloudError(error);
 if(!data)return emptyState();
 normalizeImport(data.data);return data.data;
}
export async function saveCloud(state,command,expected){
 if(state.revision!==expected)throw Error('数据已更新，请重新打开编辑。');
 const next=applyCommand(state,command);
 const cloud=await getCloud();
 const {data,error}=await cloud.rpc('offer_save_workspace',{expected_revision:expected,next_data:next});
 if(error)throw cloudError(error);
 return data;
}
