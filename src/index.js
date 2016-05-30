import {asyncReplace} from 'stc-helper';
import {isMaster} from 'cluster';

/**
 * stc plugin abstract class
 */
export default class {
  /**
   * constructor
   */
  constructor(file, opts = {}){
    this.file = file;
    this.options = opts.options || {};
    this.config = opts.config;
    this.cluster = opts.cluster;
    this.fileManage = opts.fileManage;
  }
  /**
   * get file content
   */
  getContent(encoding){
    if(isMaster){
      return this.file.getContent(encoding);
    }
    return this.cluster.invoke({
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
      if(this.file.hasAst()){
        return this.file.getAst();
      }
      //get ast in worker parsed
      let ret = await this.cluster.doTask({
        type: 'getAst',
        content: this.getContent('utf8'),
        file: this.file.path
      });
      this.file.setAst(ret);
      return ret;
    }
    //get ast from master
    return this.cluster.invoke({
      method: 'getAst',
      file: this.file.path,
      options: this.options
    })
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
   * async content replace
   * must be use RegExp
   */
  replace(content = '', replace, callback){
    return asyncReplace(content, replace, callback);
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