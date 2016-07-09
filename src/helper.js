import {isMaster} from 'cluster';
import {md5} from 'stc-helper';

/**
 * get ast cache instance
 */
export function getAstCacheInstance(stc, extname){
  let astCacheKey = '__ast__';
  let astCacheInstance = stc.cacheInstances[astCacheKey];
  if(!astCacheInstance){
    astCacheInstance = new stc.cache({
      type: (stc.config.product || 'default') + '/ast/' + extname
    });
    stc.cacheInstances[astCacheKey] = astCacheInstance;
  }
  return astCacheInstance;
}

/**
 * check run method is execute
 */
export function checkRunIsExecute(instance, method){
  if(!instance.prop('__isRun__')){
    throw new Error(`${method} only allow invoked in update method`);
  } 
}

/**
 * check in master
 */
export function checkInMaster(method){
  if(!isMaster){
    throw new Error(`${method} method must be invoked in master`);
  }
}

/**
 * get file ast
 */
export async function getAst (instance, content, fn) {
  let astCacheInstance = null, cacheKey = '';
  // get ast from cache
  if(instance.stc.config.cache !== false){
    astCacheInstance = getAstCacheInstance(instance.stc, instance.file.extname);
    cacheKey = md5(content);
    let cacheData = await astCacheInstance.get(cacheKey);
    if(cacheData){
      let debug = instance.stc.debug('cache');
      debug('getAst from cache, file is `' + instance.file.path + '`');
      instance.file.setAst(cacheData);
      return cacheData;
    }
  }
  let ast = await fn();
  if(astCacheInstance){
    await astCacheInstance.set(cacheKey, ast);
  }
  return ast;
}
