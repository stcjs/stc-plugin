import {asyncReplace, isArray, isString} from 'stc-helper';
import {isMaster} from 'cluster';
import PluginInvoke from 'stc-plugin-invoke';
import path from 'path';
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
    this.TokenType = this.stc.TokenType;
    //can not use ext in sub plugins
    this.ext = opts.ext || {};
  }
  /**
   * get file content
   */
  getContent(encoding){
    if(isMaster){
      return this.file.getContent(encoding);
    }
    return this.stc.cluster.invoke({
      method: 'getContent',
      args: [encoding],
      file: this.file.path,
      options: this.options
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
      let clusterOpt = this.stc.config.cluster;
      if(this.file.hasAst() || clusterOpt === false){
        return this.file.getAst();
      }
      let content = await this.getContent('utf8');
      //get ast in worker parsed
      let ret = await this.stc.cluster.doTask({
        type: 'getAst',
        content,
        file: this.file.path
      });
      this.file.setAst(ret);
      return ret;
    }
    
    //get ast from master
    return this.stc.cluster.invoke({
      method: 'getAst',
      file: this.file.path,
      options: this.options
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
  addFile(filepath, content){
    if(!isMaster){
      throw new Error('addFile must be invoked in master');
    }
    let resolvePath = this.getResolvePath(filepath);
    return this.stc.resource.addFile(resolvePath, content);
  }
  
  /**
   * get resolve path
   */
  getResolvePath(filepath){
    let currentFilePath = path.dirname(this.file.path);
    let resolvePath = path.resolve(currentFilePath, filepath);
    let currentPath = process.cwd() + path.sep;
    if(resolvePath.indexOf(currentPath) === 0){
      resolvePath = resolvePath.slice(currentPath.length);
    }
    return resolvePath;
  }
  
  /**
   * invoke self plugin
   */
  invokeSelf(file = this.file){
    return this.invokePlugin(this.constructor, file);
  }
  
  /**
   * invoke plugin
   */
  invokePlugin(plugin, file = this.file){
    let instance = new PluginInvoke(plugin, file, {
      stc: this.stc,
      options: this.options,
      ext: this.ext
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