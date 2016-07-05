import {asyncReplace, isArray, isString, md5} from 'stc-helper';
import {isMaster} from 'cluster';
import PluginInvoke from 'stc-plugin-invoke';
import path from 'path';
import url from 'url';


/**
 * get ast cache instance
 */
const getAstCacheInstance = (stc, extname) => {
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
 * stc plugin abstract class
 */
export default class StcPlugin {
  /**
   * constructor
   */
  constructor(file, opts = {}){
    this.file = file;
    this.options = opts.options || {};
    this.stc = opts.stc;
    this.config = this.stc.config;
    this.TokenType = this.stc.flkit.TokenType;
    //can not use ext in sub plugins
    this.ext = opts.ext || {};
    //store other properties
    this._prop = {};
  }
  /**
   * get or set properties
   */
  prop(name, value){
    if(value === undefined){
      return this._prop[name];
    }
    this._prop[name] = value;
    return this;
  }
  /**
   * get md5 value of plugin
   */
  getMd5(){
    if(this.prop('md5')){
      return this.prop('md5');
    }
    let value = md5(this.constructor.toString());
    this.prop('md5', value);
    return value;
  }
  /**
   * get file content
   */
  getContent(encoding){
    if(isMaster){
      return this.file.getContent(encoding);
    }
    return this.stc.cluster.workerInvoke({
      method: 'getContent',
      args: [encoding],
      file: this.file.path
    });
  }
  /**
   * set file content
   */
  setContent(content){
    if(!isMaster){
      throw new Error('setContent method must be invoked in master');
    }
    this.file.setContent(content);
    return this;
  }
  /**
   * get file ast
   */
  async getAst(){
    if(isMaster){
      
      if(this.file.hasAst()){
        return this.file.getAst();
      }
      
      let clusterOpt = this.stc.config.cluster;
      let content = await this.getContent('utf8');
      let astCacheInstance = null, cacheKey = '';

      // get ast from cache
      if(this.stc.config.cache !== false){
        astCacheInstance = getAstCacheInstance(this.stc, this.file.extname);
        cacheKey = md5(content);
        let cacheData = await astCacheInstance.get(cacheKey);
        if(cacheData){
          let debug = this.stc.debug('cache');
          debug('getAst from cache, file is `' + this.file.path + '`');
          this.file.setAst(cacheData);
          return cacheData;
        }
      }
      // turn off cluster
      if(clusterOpt === false){
        let data = await this.file.getAst();
        if(astCacheInstance){
          await astCacheInstance.set(cacheKey, data);
        }
        return data;
      }
      
      //get ast in worker parsed
      let ret = await this.stc.cluster.masterInvoke({
        type: 'getAst',
        content,
        file: this.file.path
      });
      
      if(astCacheInstance){
        await astCacheInstance.set(cacheKey, ret); 
      }
      this.file.setAst(ret);
      return ret;
    }

    // get AST in worker
    // must be transform from master
    return this.stc.cluster.workerInvoke({
      method: 'getAst',
      file: this.file.path
    });
  }
  /**
   * set ast
   */
  setAst(ast){
    if(!isMaster){
      throw new Error('setAst must be invoked in master');
    }
    this.file.setAst(ast);
    return this;
  }
  /**
   * add file dependence
   */
  addDependence(dependencies){
    if(!isMaster){
      throw new Error('addDependence must be invoked in master');
    }
    if(!isArray(dependencies)){
      dependencies = [dependencies];
    }
    dependencies = dependencies.map(item => {
      if(!isString(item)){
        return item;
      }
      let filepath = this.getResolvePath(item);
      let file = this.stc.resource.lookFile(filepath, this.file.path);
      if(!file){
        throw new Error(`file ${item} is not exist in ${this.file.path}`);
      }
      return file;
    });
    this.file.dependence.add(dependencies);
    return dependencies;
  }
  /**
   * get file dependence
   */
  getDependence(file = this.file){
    return file.dependence.get();
  }

  /**
   * add file
   */
  async addFile(filepath, content, virtual){
    let resolvePath = this.getResolvePath(filepath);
    if(resolvePath[0] === '/'){
      resolvePath = resolvePath.slice(1);
    }
    if(content === true){
      virtual = true;
      content = undefined;
    }
    if(isMaster){
      return this.stc.resource.addFile(resolvePath, content, virtual);
    }
    await this.stc.cluster.workerInvoke({
      method: 'addFile',
      file: resolvePath,
      virtual,
      content
    });
    return this.stc.resource.createFile(resolvePath, content);
  }
  /**
   * get resolve path
   */
  getResolvePath(filepath){
    // parse filepath, remove query & hash in filepath
    filepath = decodeURIComponent(url.parse(filepath).pathname);
    let currentFilePath = path.dirname(this.file.path);
    let resolvePath = path.resolve(currentFilePath, filepath);
    let currentPath = process.cwd() + path.sep;
    if(resolvePath.indexOf(currentPath) === 0){
      resolvePath = resolvePath.slice(currentPath.length);
    }
    return resolvePath;
  }
  /**
   * get file by path
   */
  getFileByPath(filepath){
    filepath = this.getResolvePath(filepath);
    if(filepath[0] === '/'){
      filepath = filepath.slice(1);
    }
    if(isMaster){
      return this.stc.resource.getFileByPath(filepath);
    }
    return this.stc.resource.createFile(filepath);
  }
  
  /**
   * invoke self plugin
   */
  async invokeSelf(file = this.file){
    if(isString(file)){
      file = await this.getFileByPath(file);
    }
    return this.invokePlugin(this.constructor, file);
  }
  
  /**
   * invoke plugin
   */
  async invokePlugin(plugin, file = this.file){
    if(isString(file)){
      file = await this.getFileByPath(file);
    }
    let instance = new PluginInvoke(plugin, file, {
      stc: this.stc,
      options: this.options,
      ext: plugin === this.constructor ? this.ext : {}
    });
    return instance.run();
  }
  
  /**
   * async content replace
   * must be use RegExp
   */
  asyncReplace(content = '', replace, callback){
    return asyncReplace(content, replace, callback);
  }
  /**
   * get or set cache
   */
  async cache(name, value){
    if(isMaster){
      let md5Value = this.getMd5();
      if(!this.stc.cacheInstances[md5Value]){
        this.stc.cacheInstances[md5Value] = new this.stc.cache({
          onlyMemory: true
        })
      }
      let instance = this.stc.cacheInstances[md5Value];
      if(value === undefined){
        return instance.get(name);
      }
      instance.set(name, value);
      return this;
    }
    //get or set cache from master
    return this.stc.cluster.workerInvoke({
      method: 'cache',
      key: this.getMd5(),
      name,
      value
    });
  }
  /**
   * create token
   */
  createToken(type, value, referToken){
    return this.stc.flkit.createToken(type, value, referToken);
  }
  /**
   * throw fatal error
   */
  fatal(message, line, column, file = this.file.path){
    let error = new Error(message);
    error.className = this.constructor.name;
    error.file = file;
    error.line = line;
    error.column = column;
    throw error;
  }

  /**
   * show error log
   */
  error(message, line, column, file = this.file.path){
    this.stc.log.error({
      message,
      line,
      column,
      file,
      className: this.constructor.name
    });
  }

   /**
   * show warning log
   */
  warning(message, line, column, file = this.file.path){
    this.stc.log.warning({
      message,
      line,
      column,
      file,
      className: this.constructor.name
    });
  }

   /**
   * show notice log
   */
  notice(message, line, column, file = this.file.path){
    this.stc.log.notice({
      message,
      line,
      column,
      file,
      className: this.constructor.name
    });
  }
  
  /**
   * run
   */
  run(){
    
  }
  /**
   * update
   */
  update(){
    
  }
}