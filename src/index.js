import {asyncReplace, isArray, isString, md5, mkdir, isFile, isRemoteUrl} from 'stc-helper';
import {isMaster} from 'cluster';
import PluginInvoke from 'stc-plugin-invoke';
import path from 'path';
import url from 'url';
import fs from 'fs';
import {
  getAst,
  checkInMaster,
  checkRunIsExecute,
  getCacheInstance,
  getConcurrentLimitInstance,
  getAwaitInstance,
  getContentFromUrl
} from './helper.js';

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
    this.include = opts.include;
    //can not use ext in sub plugins
    this._ext = opts.ext || {};
    //store other properties
    this._prop = {};
  }
  /**
   * get matches
   */
  get matches(){
    return this.stc.resource.match(this.file, this.include);
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
   * is template file
   */
  isTpl(){
    return !!this.file.prop('tpl');
  }
  /**
   * get md5 value of plugin & options
   */
  getMd5(){
    if(this.prop('md5')){
      return this.prop('md5');
    }
    let value = md5(this.constructor.toString() + JSON.stringify(this.options));
    this.prop('md5', value);
    return value;
  }
  /**
   * get file content
   */
  async getContent(encoding = null){
    if(isMaster){
      return this.file.getContent(encoding);
    }
    let content = await this.stc.cluster.workerInvoke({
      method: 'getContent',
      encoding: encoding,
      file: this.file.path
    });
    if(encoding !== null){
      return content;
    }
    return new Buffer(content, 'base64');
  }
  /**
   * set file content
   */
  setContent(content){
    checkInMaster('setContent');
    checkRunIsExecute(this, 'setContent');
    this.file.setContent(content);
    return this;
  }
  /**
   * get file ast
   */
  async getAst(){
    let content = await this.getContent('utf8');

    if(isMaster){
      if(this.file.hasAst()){
        return this.file.getAst();
      }
      return getAst(this, content, async () => {
        // turn off cluster
        if(this.config.cluster === false){
          return this.file.getAst();
        }
        //get ast in worker parsed
        let ret = await this.stc.cluster.masterInvoke({
          type: 'getAst',
          content,
          file: this.file.path
        });
        this.file.setAst(ret);
        return ret;
      }, this.file.path);
    }

    return getAst(this, content, async () => {
      // if have ast in master, return directory
      let ast = await this.stc.cluster.workerInvoke({
        method: 'getAstIfExist',
        file: this.file.path
      });
      if(ast){
        return ast;
      }
      this.file.setContent(content);
      let ret = await this.file.getAst();
      // update ast in master
      await this.stc.cluster.workerInvoke({
        method: 'updateAst',
        file: this.file.path,
        ast: ret
      });
      return ret;
    });
  }
  /**
   * set ast
   */
  setAst(ast){
    checkInMaster('setAst');
    checkRunIsExecute(this, 'setAst');
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
      let file = this.stc.resource.getFileByPath(filepath, this.file.path);
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
    if(isMaster){
      return this.stc.resource.addFile(resolvePath, content, virtual);
    }
    await this.stc.cluster.workerInvoke({
      method: 'addFile',
      file: resolvePath,
      virtual,
      content
    });
    return this.stc.resource.createFile(resolvePath, content, virtual);
  }
  /**
   * get resolve path
   */
  getResolvePath(filepath){
    if(path.isAbsolute(filepath) && isFile(filepath)){
      return filepath;
    }
    // parse filepath, remove query & hash in filepath
    filepath = path.normalize(decodeURIComponent(url.parse(filepath).pathname));
    let flag = this.config.include.some(item => {
      if(item[item.length - 1] !== '/'){
        item += '/';
      }
      return filepath.indexOf(item) === 0;
    });
    if(flag){
      return filepath;
    }
    let currentFilePath = path.dirname(this.file.path);

    let resolvePath = filepath;
    if(filepath.indexOf(currentFilePath) !== 0)  {
      resolvePath = path.resolve(currentFilePath, filepath);
    }
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
    if(isMaster){
      return this.stc.resource.getFileByPath(filepath, this.file.path);
    }
    return this.stc.resource.createFile(filepath);
  }

  /**
   * invoke self plugin
   */
  invokeSelf(file = this.file, props){
    if(isString(file)){
      file = this.getFileByPath(file);
    }
    return this.invokePlugin(this.constructor, file, props);
  }

  /**
   * invoke plugin
   */
  async invokePlugin(plugin, file = this.file, props = {}){
    if(isString(file)){
      file = this.getFileByPath(file);
    }
    let instance = new PluginInvoke(plugin, file, {
      stc: this.stc,
      options: this.options,
      ext: plugin === this.constructor ? this._ext : {}
    });
    //set prop for plugin
    for(let name in props){
      instance.pluginInstance.prop(name, props[name]);
    }
    if(isMaster){
      return instance.run();
    }
    let data = await instance.run();
    await this.stc.cluster.workerInvoke({
      method: 'update',
      file: this.file.path,
      data
    });
    return data;
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
    let isFn = typeof value === 'function';
    if(isMaster){
      let instance = getCacheInstance(this);
      if(value === undefined){
        return instance.get(name);
      }
      if(isFn){
        let ret = await instance.get(name);
        if(ret !== undefined){
          return ret;
        }
        let awaitInstance = getAwaitInstance(this.getMd5());
        let ret2 = await awaitInstance.run(name, value);
        if(ret2 !== undefined){
          await instance.set(name, ret2);
        }
        return ret2;
      }
      await instance.set(name, value);
      return this;
    }

    if(isFn){
      let ret = await this.stc.cluster.workerInvoke({
        method: 'cache',
        key: this.getMd5(),
        name
      });
      if(ret !== undefined){
        return ret;
      }
      let awaitInstance = getAwaitInstance(this.getMd5());
      let ret2 = await awaitInstance.run(name, value);
      if(ret2 !== undefined){
        await this.stc.cluster.workerInvoke({
          method: 'cache',
          key: this.getMd5(),
          name,
          value: ret2
        });
      }
      return ret2;
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
   * storage
   */
  storage(name, value){
    let product = this.config.product || 'default';
    let savePath = path.normalize(`${this.config.cachePath}/storage/${product}/${name}.json`);
    mkdir(path.dirname(savePath));
    if(value === undefined){
      if(isFile(savePath)){
        let data = fs.readFileSync(savePath, 'utf8');
        return JSON.parse(data);
      }
      return;
    }
    fs.writeFileSync(savePath, JSON.stringify(value));
  }
  /**
   * create token
   */
  createToken(type, value, referToken){
    return this.stc.flkit.createToken(type, value, referToken);
  }
  /**
   * create raw token in html
   */
  createRawToken(type, value, referToken){
    return this.stc.flkit.createRawToken(type, value, referToken);
  }
  /**
   * concurrent limit task
   */
  concurrentLimit(fn, ignoreErrorFn, limit, key = this.constructor.name){
    let instance = getConcurrentLimitInstance(limit, ignoreErrorFn, key);
    return instance.run(fn);
  }
  /**
   * get content from url
   */
  getContentFromUrl(url){
    if(!isRemoteUrl(url)){
      throw new Error('url must be start with http:// or https://');
    }
    let awaitInstance = getAwaitInstance(this.getMd5());
    return awaitInstance.run(url, () => {
      return getContentFromUrl(url);
    });
  }
  /**
   * await
   */
  await(key, fn){
    let instance = getAwaitInstance(key);
    return instance.run(key, fn);
  }
  /**
   * throw fatal error
   */
  fatal(message, line, column, file = this.file.path){
    let msg = {
      message,
      className: this.constructor.name,
      file,
      line,
      column
    };
    throw new Error(JSON.stringify(msg));
  }

  /**
   * show error log
   */
  error(message, line, column, file = this.file.path){
    checkRunIsExecute(this, 'error');
    this.stc.log.error({
      message,
      line: line,
      column: column,
      file,
      className: this.constructor.name
    });
  }

   /**
   * show warning log
   */
  warning(message, line, column, file = this.file.path){
    checkRunIsExecute(this, 'warning');
    this.stc.log.warning({
      message,
      line: line,
      column: column,
      file,
      className: this.constructor.name
    });
  }

   /**
   * show notice log
   */
  notice(message, line, column, file = this.file.path){
    checkRunIsExecute(this, 'notice');
    this.stc.log.notice({
      message,
      line: line,
      column: column,
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