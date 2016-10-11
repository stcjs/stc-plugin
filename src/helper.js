import {isMaster} from 'cluster';
import {md5, promisify} from 'stc-helper';
import ConcurrentLimit from './concurrent_limit.js';
import Await from 'stc-await';
import request from 'request';

/**
 * concurrent limit task instances
 */
const concurrentLimitInstances = {};
/**
 * await instances
 */
const awaitInstances = {};

/**
 * get ast cache instance
 */
export function getAstCacheInstance(stc, extname){
  let astCacheKey = '__ast__';
  let astCacheInstance = stc.cacheInstances[astCacheKey];
  if(!astCacheInstance){
    astCacheInstance = new stc.cache({
      path: stc.config.cachePath,
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
export async function getAst (instance, content, fn, filepath) {
  let astCacheInstance = null, cacheKey = '';
  // get ast from cache
  if(instance.stc.config.cache !== false){
    astCacheInstance = getAstCacheInstance(instance.stc, instance.file.extname);
    cacheKey = md5(instance.stc.config._tplCacheKey + content + filepath);
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
/**
 * get cache instance
 */
export function getCacheInstance(plugin, onlyMemory = true){
  let md5Value = plugin.getMd5() + onlyMemory ? 'true' : 'false';
  if(!plugin.stc.cacheInstances[md5Value]){
    plugin.stc.cacheInstances[md5Value] = new plugin.stc.cache({
      path: plugin.config.cachePath,
      onlyMemory
    });
  }
  return plugin.stc.cacheInstances[md5Value];
}

/**
 * get concurrent limit instance
 */
export function getConcurrentLimitInstance(limit, ignoreErrorFn, key){
  if(!(key in concurrentLimitInstances)){
    concurrentLimitInstances[key] = new ConcurrentLimit(limit, ignoreErrorFn);
  }
  return concurrentLimitInstances[key];
}
/**
 * get await instance
 */
export function getAwaitInstance(key){
  if(!(key in awaitInstances)){
    awaitInstances[key] = new Await();
  }
  return awaitInstances[key];
}
/**
 * get content from url
 */
export async function getContentFromUrl(url){
  let fn = promisify(request.get, request);
  let result = await fn(url, {
    method: 'get',
    strictSSL: false,
    timeout: 20 * 1000,
    encoding: null,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.113 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,ja;q=0.4,nl;q=0.2,zh-TW;q=0.2'
    }
  });
  return result.body;
}